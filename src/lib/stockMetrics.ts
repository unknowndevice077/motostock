import type { Part, Motorcycle } from "@/types";

export interface StockMetrics {
  /** Total cost basis of everything on the shelf right now (parts + motorcycles). */
  totalCost: number;
  /** What it would all sell for at listed retail price. */
  totalRetail: number;
  potentialProfit: number;
  /** Distinct part records (SKUs), not units. */
  totalSkus: number;
  /** Sum of every part's stock count. */
  totalPartUnits: number;
  /** Sum of every motorcycle's stock count. */
  totalBikeUnits: number;
  /** Parts with zero stock — a stricter subset of lowStock. */
  outOfStock: Part[];
  /** Parts at or below their configured minimum threshold. */
  lowStock: Part[];
  /** Retail value grouped by category, largest first isn't guaranteed — sort at render time. */
  chartData: { label: string; value: number }[];
}

/**
 * The shop's current inventory valuation — pure function over already-loaded
 * parts/motorcycles, so both the Dashboard and the Sales Report can show the
 * same "stock asset evaluation" numbers without duplicating the math.
 */
export function computeStockMetrics(parts: Part[], motorcycles: Motorcycle[]): StockMetrics {
  const partsCost = parts.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const partsRetail = parts.reduce((sum, p) => sum + p.stock * p.sellingPrice, 0);
  const bikesCost = motorcycles.reduce((sum, m) => sum + m.stock * m.cost, 0);
  const bikesRetail = motorcycles.reduce((sum, m) => sum + m.stock * m.price, 0);
  const totalCost = partsCost + bikesCost;
  const totalRetail = partsRetail + bikesRetail;

  const byCategory = new Map<string, number>();
  for (const p of parts) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.stock * p.sellingPrice);
  for (const m of motorcycles) byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + m.stock * m.price);

  return {
    totalCost,
    totalRetail,
    potentialProfit: totalRetail - totalCost,
    totalSkus: parts.length,
    totalPartUnits: parts.reduce((sum, p) => sum + p.stock, 0),
    totalBikeUnits: motorcycles.reduce((sum, m) => sum + m.stock, 0),
    outOfStock: parts.filter((p) => p.stock === 0),
    lowStock: parts.filter((p) => p.stock <= p.minThreshold),
    chartData: Array.from(byCategory.entries()).map(([label, value]) => ({ label, value })),
  };
}
