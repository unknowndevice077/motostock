import { getDb, newId, nowIso } from "./client";
import type { Part, PartCategory, StockReceipt } from "@/types";

interface PartRow {
  id: string;
  shop_id: string;
  part_name: string;
  part_number: string;
  category: PartCategory;
  stock: number;
  min_threshold: number;
  cost_price: number;
  selling_price: number;
  updated_at: string;
}

function mapPart(row: PartRow): Part {
  return {
    id: row.id,
    shopId: row.shop_id,
    partName: row.part_name,
    partNumber: row.part_number,
    category: row.category,
    stock: row.stock,
    minThreshold: row.min_threshold,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    updatedAt: row.updated_at,
  };
}

export async function listParts(shopId: string): Promise<Part[]> {
  const db = await getDb();
  const rows = await db.select<PartRow[]>(
    "SELECT * FROM parts WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY part_name ASC",
    [shopId]
  );
  return rows.map(mapPart);
}

export interface PartInput {
  partName: string;
  partNumber: string;
  category: PartCategory;
  stock: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number;
}

export async function createPart(shopId: string, input: PartInput): Promise<Part> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO parts (id, shop_id, part_name, part_number, category, stock, min_threshold, cost_price, selling_price, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
    [id, shopId, input.partName, input.partNumber, input.category, input.stock, input.minThreshold, input.costPrice, input.sellingPrice, now, now]
  );
  return { id, shopId, updatedAt: now, ...input };
}

export async function updatePart(id: string, input: PartInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    `UPDATE parts SET part_name = $1, part_number = $2, category = $3, stock = $4, min_threshold = $5, cost_price = $6, selling_price = $7, updated_at = $8, dirty = 1
     WHERE id = $9`,
    [input.partName, input.partNumber, input.category, input.stock, input.minThreshold, input.costPrice, input.sellingPrice, now, id]
  );
}

export async function deletePart(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE parts SET deleted_at = $1, updated_at = $2, dirty = 1 WHERE id = $3", [now, now, id]);
}

/** Decrements stock for a part, clamped at 0. Used by POS checkout and repair jobs. */
export async function decrementPartStock(id: string, qty: number): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    "UPDATE parts SET stock = MAX(0, stock - $1), updated_at = $2, dirty = 1 WHERE id = $3",
    [qty, now, id]
  );
}

// --- INGOING STOCK (receiving from a supplier) ---

interface StockReceiptRow {
  id: string;
  shop_id: string;
  part_id: string;
  user_id: string | null;
  qty: number;
  unit_cost: number;
  supplier: string | null;
  reference: string | null;
  created_at: string;
}

function mapReceipt(row: StockReceiptRow): StockReceipt {
  return {
    id: row.id,
    shopId: row.shop_id,
    partId: row.part_id,
    userId: row.user_id,
    qty: row.qty,
    unitCost: row.unit_cost,
    supplier: row.supplier,
    reference: row.reference,
    createdAt: row.created_at,
  };
}

export interface ReceiveStockInput {
  partId: string;
  userId: string | null;
  qty: number;
  unitCost: number;
  supplier: string;
  reference: string;
}

/** Records an ingoing stock event and bumps the part's stock + cost price. */
export async function receiveStock(shopId: string, input: ReceiveStockInput): Promise<void> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO stock_receipts (id, shop_id, part_id, user_id, qty, unit_cost, supplier, reference, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)`,
    [id, shopId, input.partId, input.userId, input.qty, input.unitCost, input.supplier || null, input.reference || null, now, now]
  );
  await db.execute(
    "UPDATE parts SET stock = stock + $1, cost_price = $2, updated_at = $3, dirty = 1 WHERE id = $4",
    [input.qty, input.unitCost, now, input.partId]
  );
}

export async function listStockReceipts(shopId: string, partId?: string): Promise<StockReceipt[]> {
  const db = await getDb();
  const rows = partId
    ? await db.select<StockReceiptRow[]>(
        "SELECT * FROM stock_receipts WHERE shop_id = $1 AND part_id = $2 ORDER BY created_at DESC",
        [shopId, partId]
      )
    : await db.select<StockReceiptRow[]>(
        "SELECT * FROM stock_receipts WHERE shop_id = $1 ORDER BY created_at DESC LIMIT 50",
        [shopId]
      );
  return rows.map(mapReceipt);
}
