import { getDb } from "./client";

export interface MonthlyRevenue {
  /** "2026-08" */
  month: string;
  partsRevenue: number;
  repairsRevenue: number;
  total: number;
  transactionCount: number;
}

export interface TopPart {
  partName: string;
  partNumber: string;
  qtySold: number;
  revenue: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Revenue by month for the last `months` calendar months (oldest first),
 * combining POS parts sales and completed repair jobs. Months with no
 * activity are included as zero so the chart's x-axis stays evenly spaced.
 * Whole-motorcycle sales aren't included — the Showroom module tracks stock
 * counts, not dated sale transactions, so there's nothing to aggregate yet.
 */
export async function getMonthlyRevenue(shopId: string, months = 6): Promise<MonthlyRevenue[]> {
  const db = await getDb();

  const salesRows = await db.select<{ month: string; total: number; n: number }[]>(
    `SELECT strftime('%Y-%m', created_at) as month, SUM(total) as total, COUNT(*) as n
     FROM sales WHERE shop_id = $1 AND deleted_at IS NULL GROUP BY month`,
    [shopId]
  );
  const jobRows = await db.select<{ month: string; total: number; n: number }[]>(
    `SELECT strftime('%Y-%m', completed_at) as month, SUM(total) as total, COUNT(*) as n
     FROM repair_jobs WHERE shop_id = $1 AND deleted_at IS NULL AND status = 'completed' AND completed_at IS NOT NULL
     GROUP BY month`,
    [shopId]
  );

  const salesByMonth = new Map(salesRows.map((r) => [r.month, r]));
  const jobsByMonth = new Map(jobRows.map((r) => [r.month, r]));

  const now = new Date();
  const result: MonthlyRevenue[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const s = salesByMonth.get(key);
    const j = jobsByMonth.get(key);
    result.push({
      month: key,
      partsRevenue: s?.total ?? 0,
      repairsRevenue: j?.total ?? 0,
      total: (s?.total ?? 0) + (j?.total ?? 0),
      transactionCount: (s?.n ?? 0) + (j?.n ?? 0),
    });
  }
  return result;
}

export { monthLabel };

/** Best-selling parts by revenue since `sinceIso`, POS sales only. */
export async function getTopParts(shopId: string, sinceIso: string, limit = 5): Promise<TopPart[]> {
  const db = await getDb();
  const rows = await db.select<{ part_name: string; part_number: string; qty_sold: number; revenue: number }[]>(
    `SELECT si.part_name as part_name, si.part_number as part_number,
            SUM(si.qty) as qty_sold, SUM(si.qty * si.unit_price) as revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.shop_id = $1 AND s.deleted_at IS NULL AND s.created_at >= $2
     GROUP BY si.part_id
     ORDER BY revenue DESC
     LIMIT $3`,
    [shopId, sinceIso, limit]
  );
  return rows.map((r) => ({ partName: r.part_name, partNumber: r.part_number, qtySold: r.qty_sold, revenue: r.revenue }));
}

/** Same as getTopParts, but scoped to one specific "2026-08"-style month
 * instead of an open-ended "since" range — powers the drill-down when a
 * month is clicked on the Reports page. */
export async function getTopPartsForMonth(shopId: string, month: string, limit = 5): Promise<TopPart[]> {
  const db = await getDb();
  const rows = await db.select<{ part_name: string; part_number: string; qty_sold: number; revenue: number }[]>(
    `SELECT si.part_name as part_name, si.part_number as part_number,
            SUM(si.qty) as qty_sold, SUM(si.qty * si.unit_price) as revenue
     FROM sale_items si
     JOIN sales s ON s.id = si.sale_id
     WHERE s.shop_id = $1 AND s.deleted_at IS NULL AND strftime('%Y-%m', s.created_at) = $2
     GROUP BY si.part_id
     ORDER BY revenue DESC
     LIMIT $3`,
    [shopId, month, limit]
  );
  return rows.map((r) => ({ partName: r.part_name, partNumber: r.part_number, qtySold: r.qty_sold, revenue: r.revenue }));
}

export interface DayActivity {
  total: number;
  transactionCount: number;
}

/** Revenue and transaction count for just today — the "what's happened so
 * far today" figure a POS dashboard normally leads with, distinct from the
 * month-to-date totals the Sales Report tracks. */
export async function getTodayActivity(shopId: string): Promise<DayActivity> {
  const db = await getDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const since = todayStart.toISOString();

  const salesRows = await db.select<{ total: number | null; n: number }[]>(
    `SELECT SUM(total) as total, COUNT(*) as n FROM sales WHERE shop_id = $1 AND deleted_at IS NULL AND created_at >= $2`,
    [shopId, since]
  );
  const jobRows = await db.select<{ total: number | null; n: number }[]>(
    `SELECT SUM(total) as total, COUNT(*) as n FROM repair_jobs
     WHERE shop_id = $1 AND deleted_at IS NULL AND status = 'completed' AND completed_at >= $2`,
    [shopId, since]
  );
  return {
    total: (salesRows[0]?.total ?? 0) + (jobRows[0]?.total ?? 0),
    transactionCount: (salesRows[0]?.n ?? 0) + (jobRows[0]?.n ?? 0),
  };
}

export interface MonthTransaction {
  id: string;
  kind: "sale" | "repair";
  date: string;
  customerName: string | null;
  total: number;
}

/** Every individual sale and completed repair job that makes up one month's
 * total, newest first — the actual "detailed report" behind the aggregate
 * numbers, so an owner can see (and click into) exactly what happened. */
export async function getMonthTransactions(shopId: string, month: string): Promise<MonthTransaction[]> {
  const db = await getDb();
  const salesRows = await db.select<{ id: string; created_at: string; customer_name: string | null; total: number }[]>(
    `SELECT id, created_at, customer_name, total FROM sales
     WHERE shop_id = $1 AND deleted_at IS NULL AND strftime('%Y-%m', created_at) = $2
     ORDER BY created_at DESC`,
    [shopId, month]
  );
  const jobRows = await db.select<{ id: string; completed_at: string; customer_name: string; total: number }[]>(
    `SELECT id, completed_at, customer_name, total FROM repair_jobs
     WHERE shop_id = $1 AND deleted_at IS NULL AND status = 'completed' AND completed_at IS NOT NULL AND strftime('%Y-%m', completed_at) = $2
     ORDER BY completed_at DESC`,
    [shopId, month]
  );

  const combined: MonthTransaction[] = [
    ...salesRows.map((r) => ({ id: r.id, kind: "sale" as const, date: r.created_at, customerName: r.customer_name, total: r.total })),
    ...jobRows.map((r) => ({ id: r.id, kind: "repair" as const, date: r.completed_at, customerName: r.customer_name, total: r.total })),
  ];
  return combined.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Every sale and repair job (any status, not just completed — an open job
 * still belongs on a customer's history) tied to one customer, newest
 * first. Powers the "View customer history" page — same merge shape as
 * `getMonthTransactions` above, just scoped by customer instead of month. */
export async function getCustomerTransactions(shopId: string, customerId: string): Promise<MonthTransaction[]> {
  const db = await getDb();
  const salesRows = await db.select<{ id: string; created_at: string; customer_name: string | null; total: number }[]>(
    `SELECT id, created_at, customer_name, total FROM sales
     WHERE shop_id = $1 AND deleted_at IS NULL AND customer_id = $2
     ORDER BY created_at DESC`,
    [shopId, customerId]
  );
  const jobRows = await db.select<{ id: string; created_at: string; customer_name: string; total: number }[]>(
    `SELECT id, created_at, customer_name, total FROM repair_jobs
     WHERE shop_id = $1 AND deleted_at IS NULL AND customer_id = $2
     ORDER BY created_at DESC`,
    [shopId, customerId]
  );

  const combined: MonthTransaction[] = [
    ...salesRows.map((r) => ({ id: r.id, kind: "sale" as const, date: r.created_at, customerName: r.customer_name, total: r.total })),
    ...jobRows.map((r) => ({ id: r.id, kind: "repair" as const, date: r.created_at, customerName: r.customer_name, total: r.total })),
  ];
  return combined.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** The most recent handful of sales and completed repair jobs, regardless
 * of date — the Dashboard's "what just happened" activity feed. */
export async function getRecentTransactions(shopId: string, limit = 8): Promise<MonthTransaction[]> {
  const db = await getDb();
  const salesRows = await db.select<{ id: string; created_at: string; customer_name: string | null; total: number }[]>(
    `SELECT id, created_at, customer_name, total FROM sales
     WHERE shop_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2`,
    [shopId, limit]
  );
  const jobRows = await db.select<{ id: string; completed_at: string; customer_name: string; total: number }[]>(
    `SELECT id, completed_at, customer_name, total FROM repair_jobs
     WHERE shop_id = $1 AND deleted_at IS NULL AND status = 'completed' AND completed_at IS NOT NULL
     ORDER BY completed_at DESC LIMIT $2`,
    [shopId, limit]
  );

  const combined: MonthTransaction[] = [
    ...salesRows.map((r) => ({ id: r.id, kind: "sale" as const, date: r.created_at, customerName: r.customer_name, total: r.total })),
    ...jobRows.map((r) => ({ id: r.id, kind: "repair" as const, date: r.completed_at, customerName: r.customer_name, total: r.total })),
  ];
  return combined.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, limit);
}

export interface TopCustomer {
  customerId: string;
  name: string;
  total: number;
  transactionCount: number;
}

/** Highest-spending customers since `sinceIso`, combining parts sales and
 * completed repair jobs — walk-ins with no customer attached don't count,
 * since there's nothing to attribute the spend to. */
export async function getTopCustomers(shopId: string, sinceIso: string, limit = 5): Promise<TopCustomer[]> {
  const db = await getDb();
  const rows = await db.select<{ customer_id: string; name: string; total: number; n: number }[]>(
    `SELECT c.id as customer_id, c.name as name, SUM(x.total) as total, COUNT(*) as n FROM (
       SELECT customer_id, total FROM sales
       WHERE shop_id = $1 AND deleted_at IS NULL AND customer_id IS NOT NULL AND created_at >= $2
       UNION ALL
       SELECT customer_id, total FROM repair_jobs
       WHERE shop_id = $1 AND deleted_at IS NULL AND customer_id IS NOT NULL AND status = 'completed' AND completed_at >= $2
     ) x
     JOIN customers c ON c.id = x.customer_id
     GROUP BY c.id, c.name
     ORDER BY total DESC
     LIMIT $3`,
    [shopId, sinceIso, limit]
  );
  return rows.map((r) => ({ customerId: r.customer_id, name: r.name, total: r.total, transactionCount: r.n }));
}
