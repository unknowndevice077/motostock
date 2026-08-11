import { getDb, newId, nowIso } from "./client";
import type { Motorcycle, MotorcycleCategory } from "@/types";

interface MotorcycleRow {
  id: string;
  shop_id: string;
  model_name: string;
  vin: string;
  displacement: string;
  category: MotorcycleCategory;
  price: number;
  cost: number;
  stock: number;
  updated_at: string;
}

function mapMotorcycle(row: MotorcycleRow): Motorcycle {
  return {
    id: row.id,
    shopId: row.shop_id,
    modelName: row.model_name,
    vin: row.vin,
    displacement: row.displacement,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    updatedAt: row.updated_at,
  };
}

export async function listMotorcycles(shopId: string): Promise<Motorcycle[]> {
  const db = await getDb();
  const rows = await db.select<MotorcycleRow[]>(
    "SELECT * FROM motorcycles WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY model_name ASC",
    [shopId]
  );
  return rows.map(mapMotorcycle);
}

export interface MotorcycleInput {
  modelName: string;
  vin: string;
  displacement: string;
  category: MotorcycleCategory;
  price: number;
  cost: number;
  stock: number;
}

export async function createMotorcycle(shopId: string, input: MotorcycleInput): Promise<Motorcycle> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO motorcycles (id, shop_id, model_name, vin, displacement, category, price, cost, stock, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
    [id, shopId, input.modelName, input.vin, input.displacement, input.category, input.price, input.cost, input.stock, now, now]
  );
  return { id, shopId, updatedAt: now, ...input };
}

export async function updateMotorcycle(id: string, input: MotorcycleInput): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute(
    `UPDATE motorcycles SET model_name = $1, vin = $2, displacement = $3, category = $4, price = $5, cost = $6, stock = $7, updated_at = $8, dirty = 1
     WHERE id = $9`,
    [input.modelName, input.vin, input.displacement, input.category, input.price, input.cost, input.stock, now, id]
  );
}

export async function deleteMotorcycle(id: string): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  await db.execute("UPDATE motorcycles SET deleted_at = $1, updated_at = $2, dirty = 1 WHERE id = $3", [now, now, id]);
}
