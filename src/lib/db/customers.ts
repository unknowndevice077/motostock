import { getDb, newId, nowIso } from "./client";
import type { Customer } from "@/types";

interface CustomerRow {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

function mapCustomer(row: CustomerRow): Customer {
  return { id: row.id, shopId: row.shop_id, name: row.name, phone: row.phone, createdAt: row.created_at };
}

export async function listCustomers(shopId: string): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.select<CustomerRow[]>(
    "SELECT * FROM customers WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY name COLLATE NOCASE",
    [shopId]
  );
  return rows.map(mapCustomer);
}

/** Quick name/phone match for the customer picker's dropdown, capped small since it's typed as-you-go. */
export async function searchCustomers(shopId: string, query: string, limit = 8): Promise<Customer[]> {
  const q = query.trim();
  if (!q) return [];
  const db = await getDb();
  const rows = await db.select<CustomerRow[]>(
    `SELECT * FROM customers WHERE shop_id = $1 AND deleted_at IS NULL AND (name LIKE $2 OR phone LIKE $2)
     ORDER BY name COLLATE NOCASE LIMIT $3`,
    [shopId, `%${q}%`, limit]
  );
  return rows.map(mapCustomer);
}

/**
 * Resolves a typed name to a customer: reuses an existing one with the same
 * name (case-insensitive), or creates a new one. This is what POS and the
 * repair-job form call — picking a customer is a one-step type-and-go, not
 * a separate "create customer" screen.
 */
export async function getOrCreateCustomer(shopId: string, name: string, phone: string | null): Promise<Customer> {
  const trimmedName = name.trim();
  const db = await getDb();
  const existing = await db.select<CustomerRow[]>(
    "SELECT * FROM customers WHERE shop_id = $1 AND deleted_at IS NULL AND name = $2 COLLATE NOCASE LIMIT 1",
    [shopId, trimmedName]
  );
  if (existing.length) {
    const row = existing[0];
    // Fill in a phone number if one wasn't on file yet — never overwrites an existing one.
    if (phone && !row.phone) {
      await db.execute("UPDATE customers SET phone = $1, updated_at = $2, dirty = 1 WHERE id = $3", [phone, nowIso(), row.id]);
      row.phone = phone;
    }
    return mapCustomer(row);
  }

  const id = newId();
  const now = nowIso();
  await db.execute(
    "INSERT INTO customers (id, shop_id, name, phone, created_at, updated_at, dirty) VALUES ($1, $2, $3, $4, $5, $6, 1)",
    [id, shopId, trimmedName, phone || null, now, now]
  );
  return { id, shopId, name: trimmedName, phone: phone || null, createdAt: now };
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const db = await getDb();
  const rows = await db.select<CustomerRow[]>("SELECT * FROM customers WHERE id = $1", [id]);
  return rows.length ? mapCustomer(rows[0]) : null;
}
