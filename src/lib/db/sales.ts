import { getDb, newId, nowIso } from "./client";
import { decrementPartStock } from "./parts";
import type { Sale, SaleItem } from "@/types";

interface SaleRow {
  id: string;
  shop_id: string;
  user_id: string | null;
  customer_name: string | null;
  total: number;
  created_at: string;
}

interface SaleItemRow {
  id: string;
  sale_id: string;
  part_id: string;
  part_name: string;
  part_number: string;
  qty: number;
  unit_price: number;
}

function mapItem(row: SaleItemRow): SaleItem {
  return { id: row.id, saleId: row.sale_id, partId: row.part_id, partName: row.part_name, partNumber: row.part_number, qty: row.qty, unitPrice: row.unit_price };
}

function mapSale(row: SaleRow, items: SaleItem[]): Sale {
  return { id: row.id, shopId: row.shop_id, userId: row.user_id, customerName: row.customer_name, total: row.total, createdAt: row.created_at, items };
}

export interface CartLine {
  partId: string;
  partName: string;
  partNumber: string;
  qty: number;
  unitPrice: number;
}

/** Creates a POS sale, snapshots line items, and decrements part stock for each line. */
export async function createSale(shopId: string, userId: string | null, customerName: string | null, lines: CartLine[]): Promise<Sale> {
  if (lines.length === 0) throw new Error("Cannot create a sale with no items.");
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  const total = lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  await db.execute(
    `INSERT INTO sales (id, shop_id, user_id, customer_name, total, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [id, shopId, userId, customerName || null, total, now, now]
  );

  const items: SaleItem[] = [];
  for (const line of lines) {
    const itemId = newId();
    await db.execute(
      `INSERT INTO sale_items (id, sale_id, part_id, part_name, part_number, qty, unit_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [itemId, id, line.partId, line.partName, line.partNumber, line.qty, line.unitPrice]
    );
    await decrementPartStock(line.partId, line.qty);
    items.push({ id: itemId, saleId: id, partId: line.partId, partName: line.partName, partNumber: line.partNumber, qty: line.qty, unitPrice: line.unitPrice });
  }

  return mapSale({ id, shop_id: shopId, user_id: userId, customer_name: customerName, total, created_at: now }, items);
}

export async function listSales(shopId: string): Promise<Sale[]> {
  const db = await getDb();
  const rows = await db.select<SaleRow[]>("SELECT * FROM sales WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [shopId]);
  return rows.map((row) => mapSale(row, []));
}

/** Purchase history: most recent sales with their line items already
 * attached (one bulk query for items instead of one per sale), so a
 * history list can show what was actually purchased without an extra
 * click per row. */
export async function listSalesWithItems(shopId: string, limit = 200): Promise<Sale[]> {
  const db = await getDb();
  const saleRows = await db.select<SaleRow[]>(
    "SELECT * FROM sales WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2",
    [shopId, limit]
  );
  if (saleRows.length === 0) return [];

  const placeholders = saleRows.map((_, i) => `$${i + 1}`).join(", ");
  const itemRows = await db.select<SaleItemRow[]>(
    `SELECT * FROM sale_items WHERE sale_id IN (${placeholders})`,
    saleRows.map((r) => r.id)
  );
  const itemsBySale = new Map<string, SaleItem[]>();
  for (const row of itemRows) {
    const item = mapItem(row);
    const list = itemsBySale.get(item.saleId) ?? [];
    list.push(item);
    itemsBySale.set(item.saleId, list);
  }

  return saleRows.map((row) => mapSale(row, itemsBySale.get(row.id) ?? []));
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const db = await getDb();
  const saleRows = await db.select<SaleRow[]>("SELECT * FROM sales WHERE id = $1", [id]);
  if (!saleRows.length) return null;
  const itemRows = await db.select<SaleItemRow[]>("SELECT * FROM sale_items WHERE sale_id = $1", [id]);
  return mapSale(saleRows[0], itemRows.map(mapItem));
}
