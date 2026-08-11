import { getDb, newId, nowIso } from "./client";
import type { Shop } from "@/types";

interface ShopRow {
  id: string;
  name: string;
  logo: string | null;
  created_at: string;
  updated_at: string;
}

function mapShop(row: ShopRow): Shop {
  return { id: row.id, name: row.name, logo: row.logo ?? null, createdAt: row.created_at, updatedAt: row.updated_at };
}

/**
 * Each local install serves one shop (the "local-first per shop" model), so
 * the shop is effectively a singleton row in this database. `shopId` is
 * still threaded through every table for forward-compat with cloud sync.
 */
export async function getCurrentShop(): Promise<Shop | null> {
  const db = await getDb();
  const rows = await db.select<ShopRow[]>("SELECT * FROM shops LIMIT 1");
  return rows.length ? mapShop(rows[0]) : null;
}

export async function createShop(name: string): Promise<Shop> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute("INSERT INTO shops (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)", [id, name, now, now]);
  return { id, name, logo: null, createdAt: now, updatedAt: now };
}

/** Inserts a shop with a caller-specified id — used when hydrating a second device from the cloud, so local and remote ids stay identical. */
export async function upsertLocalShop(id: string, name: string): Promise<Shop> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    "INSERT INTO shops (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4) ON CONFLICT(id) DO UPDATE SET name = excluded.name",
    [id, name, now, now]
  );
  return { id, name, logo: null, createdAt: now, updatedAt: now };
}

export async function renameShop(id: string, name: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE shops SET name = $1, updated_at = $2 WHERE id = $3", [name, now, id]);
}

export async function updateShopLogo(id: string, logo: string | null): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE shops SET logo = $1, updated_at = $2 WHERE id = $3", [logo, now, id]);
}
