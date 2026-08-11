import { getDb, newId, nowIso } from "./client";
import { decrementPartStock } from "./parts";
import type { RepairJob, RepairJobPart, RepairJobStatus } from "@/types";

interface JobRow {
  id: string;
  shop_id: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  motorcycle_desc: string | null;
  status: RepairJobStatus;
  labor_fee: number;
  notes: string | null;
  total: number;
  created_at: string;
  completed_at: string | null;
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
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    motorcycleDesc: row.motorcycle_desc,
    status: row.status,
    laborFee: row.labor_fee,
    notes: row.notes,
    total: row.total,
    createdAt: row.created_at,
    completedAt: row.completed_at,
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
    `INSERT INTO repair_jobs (id, shop_id, user_id, customer_name, customer_phone, motorcycle_desc, status, labor_fee, notes, total, created_at, updated_at, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11, 1)`,
    [id, shopId, userId, input.customerName, input.customerPhone || null, input.motorcycleDesc || null, input.laborFee, input.notes || null, input.laborFee, now, now]
  );
  return mapJob(
    { id, shop_id: shopId, user_id: userId, customer_name: input.customerName, customer_phone: input.customerPhone || null, motorcycle_desc: input.motorcycleDesc || null, status: "open", labor_fee: input.laborFee, notes: input.notes || null, total: input.laborFee, created_at: now, completed_at: null },
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
