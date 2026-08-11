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
}

function mapUser(row: UserRow): AppUser {
  return { id: row.id, shopId: row.shop_id, name: row.name, email: row.email, role: row.role, createdAt: row.created_at };
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
  return { id, shopId, name, email, role, createdAt: now };
}

/** Inserts a staff row with a caller-specified id — used when hydrating a second device from the cloud. */
export async function upsertLocalUser(id: string, shopId: string, name: string, email: string, password: string, role: Role): Promise<AppUser> {
  const db = await getDb();
  const now = nowIso();
  const passwordHash = await hashPassword(password);
  await db.execute(
    `INSERT INTO app_users (id, shop_id, name, email, password_hash, role, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, password_hash = excluded.password_hash, role = excluded.role`,
    [id, shopId, name, email.toLowerCase().trim(), passwordHash, role, now, now]
  );
  return { id, shopId, name, email, role, createdAt: now };
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
