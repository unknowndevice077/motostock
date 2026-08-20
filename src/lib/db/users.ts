import { getDb, newId, nowIso } from "./client";
import type { AppUser, Role } from "@/types";

interface UserRow {
  id: string;
  shop_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
  avatar: string | null;
}

function mapUser(row: UserRow): AppUser {
  return { id: row.id, shopId: row.shop_id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at, avatar: row.avatar ?? null };
}

/**
 * SHA-256 local password check — good enough to make the login gate actually
 * verify something for the offline, local-first case. Once Supabase Auth is
 * wired up (see plan phase 8), online logins will be verified server-side and
 * this only backs the offline session cache.
 */
async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listUsers(shopId: string): Promise<AppUser[]> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>(
    "SELECT * FROM app_users WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
    [shopId]
  );
  return rows.map(mapUser);
}

export async function createUser(shopId: string, name: string, email: string, password: string, role: Role): Promise<AppUser> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const passwordHash = await hashPassword(password);
  await db.execute(
    `INSERT INTO app_users (id, shop_id, name, email, password_hash, role, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
    [id, shopId, name, email.toLowerCase().trim(), passwordHash, role, now, now]
  );
  return { id, shopId, name, email, role, createdAt: now, avatar: null };
}

/** Inserts a staff row with a caller-specified id — used when hydrating a second device from the cloud.
 * Marked cloud-provisioned immediately: signing in to join requires an existing cloud login already. */
export async function upsertLocalUser(id: string, shopId: string, name: string, email: string, password: string, role: Role): Promise<AppUser> {
  const db = await getDb();
  const now = nowIso();
  const passwordHash = await hashPassword(password);
  await db.execute(
    `INSERT INTO app_users (id, shop_id, name, email, password_hash, role, created_at, updated_at, dirty, cloud_provisioned_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, password_hash = excluded.password_hash, role = excluded.role`,
    [id, shopId, name, email.toLowerCase().trim(), passwordHash, role, now, now, now]
  );
  return { id, shopId, name, email, role, createdAt: now, avatar: null };
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE app_users SET deleted_at = $1, updated_at = $2, dirty = 1 WHERE id = $3", [now, now, id]);
}

export async function verifyLogin(email: string, password: string): Promise<AppUser | null> {
  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const rows = await db.select<UserRow[]>(
    "SELECT * FROM app_users WHERE email = $1 AND password_hash = $2 AND deleted_at IS NULL LIMIT 1",
    [email.toLowerCase().trim(), passwordHash]
  );
  return rows.length ? mapUser(rows[0]) : null;
}

// No dirty=1 here (unlike createUser) — app_users isn't one of the tables
// the generic sync engine pushes (see PARENT_TABLES in lib/sync/engine.ts);
// its cloud side is managed only through provisionShopInCloud /
// provisionStaffInCloud, neither of which touches password_hash (Supabase
// Auth owns the real password separately).
export async function updatePassword(id: string, newPassword: string): Promise<void> {
  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  await db.execute("UPDATE app_users SET password_hash = $1, updated_at = $2 WHERE id = $3", [passwordHash, nowIso(), id]);
}

export async function updateAvatar(id: string, avatar: string | null): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE app_users SET avatar = $1, updated_at = $2 WHERE id = $3", [avatar, nowIso(), id]);
}

/** Whether this account already has a cloud login — see 0004_add_cloud_provisioned.sql. */
export async function isCloudProvisioned(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ cloud_provisioned_at: string | null }[]>(
    "SELECT cloud_provisioned_at FROM app_users WHERE id = $1",
    [id]
  );
  return Boolean(rows[0]?.cloud_provisioned_at);
}

export async function markCloudProvisioned(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE app_users SET cloud_provisioned_at = $1 WHERE id = $2", [nowIso(), id]);
}

export async function getUserById(id: string): Promise<AppUser | null> {
  const db = await getDb();
  const rows = await db.select<UserRow[]>("SELECT * FROM app_users WHERE id = $1 AND deleted_at IS NULL LIMIT 1", [id]);
  return rows.length ? mapUser(rows[0]) : null;
}

export async function countUsers(shopId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM app_users WHERE shop_id = $1 AND deleted_at IS NULL",
    [shopId]
  );
  return rows[0]?.count ?? 0;
}
