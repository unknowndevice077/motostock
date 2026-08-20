import { getDb, newId, nowIso } from "./client";
import { decrementPartStock } from "./parts";
import { createBilledSale } from "./sales";
import type { CartLine } from "./sales";
import type { RepairJob, RepairJobPart, RepairJobStatus, Sale } from "@/types";

interface JobRow {
  id: string;
  shop_id: string;
  user_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  motorcycle_desc: string | null;
  status: RepairJobStatus;
  labor_fee: number;
  notes: string | null;
  total: number;
  created_at: string;
  completed_at: string | null;
  sale_id: string | null;
}

interface JobPartRow {
  id: string;
  job_id: string;
  part_id: string;
  part_name: string;
  part_number: string;
  qty: number;
  unit_price: number;
}

function mapJobPart(row: JobPartRow): RepairJobPart {
  return { id: row.id, jobId: row.job_id, partId: row.part_id, partName: row.part_name, partNumber: row.part_number, qty: row.qty, unitPrice: row.unit_price };
}

function mapJob(row: JobRow, parts: RepairJobPart[]): RepairJob {
  return {
    id: row.id,
    shopId: row.shop_id,
    userId: row.user_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    motorcycleDesc: row.motorcycle_desc,
    status: row.status,
    laborFee: row.labor_fee,
    notes: row.notes,
    total: row.total,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    saleId: row.sale_id,
    parts,
  };
}

async function recomputeJobTotal(db: Awaited<ReturnType<typeof getDb>>, jobId: string): Promise<number> {
  const rows = await db.select<{ subtotal: number | null }[]>(
    "SELECT SUM(qty * unit_price) as subtotal FROM repair_job_parts WHERE job_id = $1",
    [jobId]
  );
  const partsSubtotal = rows[0]?.subtotal ?? 0;
  const jobRows = await db.select<{ labor_fee: number }[]>("SELECT labor_fee FROM repair_jobs WHERE id = $1", [jobId]);
  const laborFee = jobRows[0]?.labor_fee ?? 0;
  const total = partsSubtotal + laborFee;
  await db.execute("UPDATE repair_jobs SET total = $1, updated_at = $2, dirty = 1 WHERE id = $3", [total, nowIso(), jobId]);
  return total;
}

export interface RepairJobInput {
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  motorcycleDesc: string;
  laborFee: number;
  notes: string;
}

export async function createRepairJob(shopId: string, userId: string | null, input: RepairJobInput): Promise<RepairJob> {
  const db = await getDb();
  const id = newId();
  const now = nowIso();
  await db.execute(
    `INSERT INTO repair_jobs (id, shop_id, user_id, customer_id, customer_name, customer_phone, motorcycle_desc, status, labor_fee, notes, total, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8, $9, $10, $11, $12, 1)`,
    [id, shopId, userId, input.customerId, input.customerName, input.customerPhone || null, input.motorcycleDesc || null, input.laborFee, input.notes || null, input.laborFee, now, now]
  );
  return mapJob(
    { id, shop_id: shopId, user_id: userId, customer_id: input.customerId, customer_name: input.customerName, customer_phone: input.customerPhone || null, motorcycle_desc: input.motorcycleDesc || null, status: "open", labor_fee: input.laborFee, notes: input.notes || null, total: input.laborFee, created_at: now, completed_at: null, sale_id: null },
    []
  );
}

/** Adds a part line to a job, decrements inventory stock, and recomputes the job total. */
export async function addPartToJob(jobId: string, partId: string, partName: string, partNumber: string, qty: number, unitPrice: number): Promise<void> {
  const db = await getDb();
  const id = newId();
  await db.execute(
    `INSERT INTO repair_job_parts (id, job_id, part_id, part_name, part_number, qty, unit_price) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, jobId, partId, partName, partNumber, qty, unitPrice]
  );
  await decrementPartStock(partId, qty);
  await recomputeJobTotal(db, jobId);
}

export async function setJobStatus(jobId: string, status: RepairJobStatus): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  if (status === "completed") {
    await db.execute("UPDATE repair_jobs SET status = $1, completed_at = $2, updated_at = $3, dirty = 1 WHERE id = $4", [status, now, now, jobId]);
  } else {
    await db.execute("UPDATE repair_jobs SET status = $1, updated_at = $2, dirty = 1 WHERE id = $3", [status, now, jobId]);
  }
}

export async function updateJobDetails(jobId: string, input: Partial<RepairJobInput>): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    motorcycle_desc: input.motorcycleDesc,
    labor_fee: input.laborFee,
    notes: input.notes,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    fields.push(`${col} = $${idx++}`);
    values.push(val);
  }
  if (fields.length === 0) return;
  fields.push(`updated_at = $${idx++}`, `dirty = 1`);
  values.push(now);
  values.push(jobId);
  await db.execute(`UPDATE repair_jobs SET ${fields.join(", ")} WHERE id = $${idx}`, values);
  if (input.laborFee !== undefined) await recomputeJobTotal(db, jobId);
}

export async function listRepairJobs(shopId: string): Promise<RepairJob[]> {
  const db = await getDb();
  const rows = await db.select<JobRow[]>("SELECT * FROM repair_jobs WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC", [shopId]);
  return rows.map((row) => mapJob(row, []));
}

export async function getRepairJob(id: string): Promise<RepairJob | null> {
  const db = await getDb();
  const jobRows = await db.select<JobRow[]>("SELECT * FROM repair_jobs WHERE id = $1", [id]);
  if (!jobRows.length) return null;
  const partRows = await db.select<JobPartRow[]>("SELECT * FROM repair_job_parts WHERE job_id = $1", [id]);
  return mapJob(jobRows[0], partRows.map(mapJobPart));
}

/**
 * Turns a repair job's parts + labor fee into one POS receipt — the "Bill &
 * Complete" action. Builds the sale directly via `createBilledSale` rather
 * than the regular `createSale` (which would decrement stock a second
 * time; each part already came out of inventory when it was added to the
 * job), links the job back to the new sale, and marks it completed.
 */
export async function billAndCompleteJob(shopId: string, userId: string | null, jobId: string): Promise<Sale> {
  const job = await getRepairJob(jobId);
  if (!job) throw new Error("Repair job not found.");
  if (job.saleId) throw new Error("This job has already been billed.");

  const lines: CartLine[] = job.parts.map((p) => ({ partId: p.partId, partName: p.partName, partNumber: p.partNumber, qty: p.qty, unitPrice: p.unitPrice }));
  const sale = await createBilledSale(shopId, userId, job.customerId, job.customerName, lines, job.laborFee);

  const db = await getDb();
  const now = nowIso();
  await db.execute(
    "UPDATE repair_jobs SET sale_id = $1, status = 'completed', completed_at = $2, updated_at = $2, dirty = 1 WHERE id = $3",
    [sale.id, now, jobId]
  );
  return sale;
}
