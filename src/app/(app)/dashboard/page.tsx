"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { listParts } from "@/lib/db/parts";
import { listMotorcycles } from "@/lib/db/motorcycles";
import { StatTile } from "@/components/ui/StatTile";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { CategoryValueChart } from "@/components/dashboard/CategoryValueChart";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconAlert } from "@/components/ui/icons";
import type { Motorcycle, Part } from "@/types";

export default function DashboardPage() {
  const { shop, currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [parts, setParts] = useState<Part[]>([]);
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    Promise.all([listParts(shop.id), listMotorcycles(shop.id)]).then(([p, m]) => {
      setParts(p);
      setMotorcycles(m);
      setLoading(false);
    });
  }, [shop]);

  const metrics = useMemo(() => {
    const partsCost = parts.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    const partsRetail = parts.reduce((sum, p) => sum + p.stock * p.sellingPrice, 0);
    const bikesCost = motorcycles.reduce((sum, m) => sum + m.stock * m.cost, 0);
    const bikesRetail = motorcycles.reduce((sum, m) => sum + m.stock * m.price, 0);
    const totalCost = partsCost + bikesCost;
    const totalRetail = partsRetail + bikesRetail;
    const lowStock = parts.filter((p) => p.stock <= p.minThreshold);

    const byCategory = new Map<string, number>();
    for (const p of parts) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + p.stock * p.sellingPrice);
    for (const m of motorcycles) byCategory.set(m.category, (byCategory.get(m.category) ?? 0) + m.stock * m.price);

    return {
      totalCost,
      totalRetail,
      potentialProfit: totalRetail - totalCost,
      lowStock,
      chartData: Array.from(byCategory.entries()).map(([label, value]) => ({ label, value })),
    };
  }, [parts, motorcycles]);

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="dashboard">
        This is your shop&apos;s snapshot — total inventory value, potential profit if everything
        sold at retail, and anything running low. Use <strong>Inventory</strong> to add stock,{" "}
        <strong>POS</strong> to sell it, and <strong>Repairs</strong> to log jobs.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Stock Asset Evaluation</h2>
        <p className="text-xs text-slate-400">Live totals across parts and motorcycle inventory.</p>
      </div>

      {loading ? (
        <TableSkeleton rows={1} cols={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Inventory Cost" value={metrics.totalCost} format="currency" accent="primary" />
          <StatTile label="Potential Retail Value" value={metrics.totalRetail} format="currency" accent="primary" />
          {isAdmin && <StatTile label="Potential Profit" value={metrics.potentialProfit} format="currency" accent="blue" />}
          <StatTile label="Low Stock Parts" value={metrics.lowStock.length} accent="amber" suffix=" flagged" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Inventory Value by Category</h3>
          <p className="text-[11px] text-slate-500 mb-1">Retail value across parts and motorcycle categories, largest first.</p>
          {loading ? <TableSkeleton rows={4} cols={1} /> : <CategoryValueChart data={metrics.chartData} />}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <IconAlert width={14} height={14} className="text-amber-400" />
            Low Stock Watchlist
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">Parts at or below their minimum threshold.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {metrics.lowStock.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">Nothing flagged right now.</p>}
            {metrics.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-amber-950/20 border border-amber-900/30 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-amber-200 truncate">{p.partName}</p>
                  <p className="text-[9px] text-slate-500 font-mono truncate">{p.partNumber}</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-400 shrink-0 ml-2">{p.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
