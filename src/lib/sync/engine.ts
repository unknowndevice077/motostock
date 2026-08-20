import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb } from "@/lib/db/client";
import { getSupabase } from "@/lib/supabase/client";
import { withTimeout } from "./withTimeout";

type Row = Record<string, unknown>;
type Db = Awaited<ReturnType<typeof getDb>>;

/** Parent tables: have shop_id + dirty + updated_at, sync as standalone units. */
const PARENT_TABLES = ["customers", "parts", "motorcycles", "sales", "repair_jobs", "stock_receipts"] as const;

/** Immutable child tables, keyed to a parent — pushed/pulled alongside it since they never change after creation. */
const CHILDREN: { table: string; parentTable: string; parentIdCol: string }[] = [
  { table: "sale_items", parentTable: "sales", parentIdCol: "sale_id" },
  { table: "repair_job_parts", parentTable: "repair_jobs", parentIdCol: "job_id" },
];

async function getLastSynced(db: Db, table: string): Promise<string | null> {
  const rows = await db.select<{ last_synced_at: string | null }[]>("SELECT last_synced_at FROM sync_meta WHERE table_name = $1", [table]);
  return rows[0]?.last_synced_at ?? null;
}

async function setLastSynced(db: Db, table: string, iso: string): Promise<void> {
  await db.execute(
    "INSERT INTO sync_meta (table_name, last_synced_at) VALUES ($1, $2) ON CONFLICT(table_name) DO UPDATE SET last_synced_at = excluded.last_synced_at",
    [table, iso]
  );
}

/** Pushes every locally-dirty row of a parent table, clearing the flag on success. Returns the ids that were pushed. */
async function pushDirty(supabase: SupabaseClient, db: Db, table: string, shopId: string): Promise<string[]> {
  const rows = await db.select<Row[]>(`SELECT * FROM ${table} WHERE shop_id = $1 AND dirty = 1`, [shopId]);
  const pushedIds: string[] = [];
  for (const row of rows) {
    const { dirty: _dirty, ...remoteRow } = row;
    const { error } = await supabase.from(table).upsert(remoteRow);
    if (!error) {
      await db.execute(`UPDATE ${table} SET dirty = 0 WHERE id = $1`, [row.id]);
      pushedIds.push(row.id as string);
    }
  }
  return pushedIds;
}

/** Pushes immutable child rows belonging to the given parent ids (created once, never edited — plain upsert). */
async function pushChildren(supabase: SupabaseClient, db: Db, childTable: string, parentIdCol: string, parentIds: string[]): Promise<void> {
  if (parentIds.length === 0) return;
  const placeholders = parentIds.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db.select<Row[]>(`SELECT * FROM ${childTable} WHERE ${parentIdCol} IN (${placeholders})`, parentIds);
  for (const row of rows) {
    await supabase.from(childTable).upsert(row);
  }
}

/** Last-write-wins upsert into a local parent table — never clobbers a not-yet-pushed local edit. */
async function upsertParentRow(db: Db, table: string, row: Row): Promise<void> {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const updateSet = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
  await db.execute(
    `INSERT INTO ${table} (${cols.join(", ")}, dirty) VALUES (${placeholders}, 0)
     ON CONFLICT(id) DO UPDATE SET ${updateSet}, dirty = 0
     WHERE ${table}.dirty = 0 AND (excluded.updated_at > ${table}.updated_at)`,
    Object.values(row)
  );
}

async function upsertChildRow(db: Db, table: string, row: Row): Promise<void> {
  const cols = Object.keys(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  await db.execute(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) ON CONFLICT(id) DO NOTHING`, Object.values(row));
}

async function pullParentTable(supabase: SupabaseClient, db: Db, table: string, shopId: string): Promise<Row[]> {
  const since = await getLastSynced(db, table);
  let query = supabase.from(table).select("*").eq("shop_id", shopId);
  if (since) query = query.gt("updated_at", since);
  const { data, error } = await query;
  if (error || !data) return [];

  let maxUpdated = since;
  for (const row of data as Row[]) {
    await upsertParentRow(db, table, row);
    const updatedAt = row.updated_at as string;
    if (!maxUpdated || updatedAt > maxUpdated) maxUpdated = updatedAt;
  }
  if (maxUpdated) await setLastSynced(db, table, maxUpdated);
  return data as Row[];
}

async function pullChildren(supabase: SupabaseClient, db: Db, childTable: string, parentIdCol: string, parentIds: string[]): Promise<void> {
  if (parentIds.length === 0) return;
  const { data, error } = await supabase.from(childTable).select("*").in(parentIdCol, parentIds);
  if (error || !data) return;
  for (const row of data as Row[]) await upsertChildRow(db, childTable, row);
}

export type SyncOutcome =
  | { ran: true; pushed: number; pulled: number }
  | { ran: false; reason: "not-configured" | "not-connected" | "offline" | "error"; error?: string };

// A whole cycle touches ~10 tables sequentially — generous, but bounded, so
// a stalled connection (a waking free-tier project, a dropped network mid-
// cycle) can never wedge this open forever. Matters most for the very first
// cycle after "Join existing shop", which runs synchronously before that
// screen's spinner can clear; the routine 60s background cycle benefits the
// same way.
const SYNC_TIMEOUT_MS = 90000;

/**
 * One push+pull cycle for every syncable table, in dependency order (parts
 * before sales, since sales reference parts). No-ops quietly if there's no
 * cloud project configured, no cloud session, or the device is offline —
 * the app is fully usable in every one of those states.
 */
export async function runSync(shopId: string): Promise<SyncOutcome> {
  const supabase = getSupabase();
  if (!supabase) return { ran: false, reason: "not-configured" };
  if (typeof navigator !== "undefined" && !navigator.onLine) return { ran: false, reason: "offline" };

  const syncOnce = async (): Promise<SyncOutcome> => {
    let pushed = 0;
    let pulled = 0;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return { ran: false, reason: "not-connected" };

    const db = await getDb();

    // Push standalone parents first — customers before sales/repair_jobs,
    // since both reference customer_id.
    for (const table of ["customers", "parts", "motorcycles", "stock_receipts"] as const) {
      pushed += (await pushDirty(supabase, db, table, shopId)).length;
    }
    // ...then parents with children, pushing each parent's children right after it.
    const pushedSaleIds = await pushDirty(supabase, db, "sales", shopId);
    pushed += pushedSaleIds.length;
    await pushChildren(supabase, db, "sale_items", "sale_id", pushedSaleIds);

    const pushedJobIds = await pushDirty(supabase, db, "repair_jobs", shopId);
    pushed += pushedJobIds.length;
    await pushChildren(supabase, db, "repair_job_parts", "job_id", pushedJobIds);

    // Pull standalone parents first...
    for (const table of ["customers", "parts", "motorcycles", "stock_receipts"] as const) {
      pulled += (await pullParentTable(supabase, db, table, shopId)).length;
    }
    // ...then parents with children, pulling each parent's children right after it.
    const pulledSales = await pullParentTable(supabase, db, "sales", shopId);
    pulled += pulledSales.length;
    await pullChildren(supabase, db, "sale_items", "sale_id", pulledSales.map((r) => r.id as string));

    const pulledJobs = await pullParentTable(supabase, db, "repair_jobs", shopId);
    pulled += pulledJobs.length;
    await pullChildren(supabase, db, "repair_job_parts", "job_id", pulledJobs.map((r) => r.id as string));

    return { ran: true, pushed, pulled };
  };

  try {
    return await withTimeout(syncOnce(), SYNC_TIMEOUT_MS, "Sync");
  } catch (err) {
    return { ran: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Count of not-yet-pushed local rows, for the "N pending" sync badge. */
export async function countPendingChanges(shopId: string): Promise<number> {
  const db = await getDb();
  let total = 0;
  for (const table of PARENT_TABLES) {
    const rows = await db.select<{ n: number }[]>(`SELECT COUNT(*) as n FROM ${table} WHERE shop_id = $1 AND dirty = 1`, [shopId]);
    total += rows[0]?.n ?? 0;
  }
  return total;
}

export { PARENT_TABLES, CHILDREN };
