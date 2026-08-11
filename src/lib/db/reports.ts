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
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
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
