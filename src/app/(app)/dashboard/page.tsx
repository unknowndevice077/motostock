"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/session";
import { listParts } from "@/lib/db/parts";
import { listRepairJobs } from "@/lib/db/repairJobs";
import { getTodayActivity, getRecentTransactions, type DayActivity, type MonthTransaction } from "@/lib/db/reports";
import { getCached, setCached } from "@/lib/db/cache";
import { computeStockMetrics } from "@/lib/stockMetrics";
import { StatTile } from "@/components/ui/StatTile";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { PART_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { IconAlert } from "@/components/ui/icons";
import type { Part, RepairJob } from "@/types";

export default function DashboardPage() {
  const { shop } = useAuth();
  const [parts, setParts] = useState<Part[]>(() => (shop && getCached<Part[]>(`parts:${shop.id}`)) || []);
  const [repairJobs, setRepairJobs] = useState<RepairJob[]>(() => (shop && getCached<RepairJob[]>(`repair_jobs:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`parts:${shop.id}`)));
  const [today, setToday] = useState<DayActivity>({ total: 0, transactionCount: 0 });
  const [recent, setRecent] = useState<MonthTransaction[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [watchlistSearch, setWatchlistSearch] = useState("");
  const [watchlistCategory, setWatchlistCategory] = useState("");

  useEffect(() => {
    if (!shop) return;
    // Cached data (if any) is already showing — this refreshes it quietly
    // instead of blocking the page behind a skeleton on every revisit.
    Promise.all([listParts(shop.id), listRepairJobs(shop.id)]).then(([p, j]) => {
      setCached(`parts:${shop.id}`, p);
      setCached(`repair_jobs:${shop.id}`, j);
      setParts(p);
      setRepairJobs(j);
      setLoading(false);
    });
  }, [shop]);

  useEffect(() => {
    if (!shop) return;
    setActivityLoading(true);
    Promise.all([getTodayActivity(shop.id), getRecentTransactions(shop.id, 8)]).then(([t, r]) => {
      setToday(t);
      setRecent(r);
      setActivityLoading(false);
    });
  }, [shop]);

  const metrics = useMemo(() => computeStockMetrics(parts, []), [parts]);
  const openJobsCount = useMemo(() => repairJobs.filter((j) => j.status !== "completed").length, [repairJobs]);

  const filteredLowStock = useMemo(() => {
    const q = watchlistSearch.trim().toLowerCase();
    return metrics.lowStock.filter((p) => {
      const matchesQuery = !q || p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q);
      const matchesCategory = !watchlistCategory || p.category === watchlistCategory;
      return matchesQuery && matchesCategory;
    });
  }, [metrics.lowStock, watchlistSearch, watchlistCategory]);

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="dashboard">
        This is your shop&apos;s day-to-day snapshot — what&apos;s sold today, what&apos;s in
        progress, and anything that needs attention. For inventory value and longer-term trends,
        see <strong>Sales Reports</strong>.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Today</h2>
        <p className="text-xs text-slate-400">Sales and repair jobs completed so far today.</p>
      </div>

      {activityLoading ? (
        <TableSkeleton rows={1} cols={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Today's Revenue" value={today.total} format="currency" accent="primary" />
          <StatTile label="Today's Transactions" value={today.transactionCount} accent="primary" />
          <StatTile label="Out of Stock" value={metrics.outOfStock.length} accent={metrics.outOfStock.length > 0 ? "amber" : "primary"} />
          <StatTile label="Open Repair Jobs" value={openJobsCount} accent="blue" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Recent Activity</h3>
          <p className="text-[11px] text-slate-500 mb-3">The latest sales and completed repair jobs, most recent first.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {activityLoading && <p className="text-[11px] text-slate-500 font-mono py-4 text-center">Loading...</p>}
            {!activityLoading && recent.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">Nothing yet — sell a part or complete a job to see it here.</p>}
            {!activityLoading &&
              recent.map((t) => (
                <Link
                  key={`${t.kind}-${t.id}`}
                  href={t.kind === "sale" ? `/pos/receipt?saleId=${t.id}` : `/repairs/detail?jobId=${t.id}`}
                  className="flex items-center justify-between bg-slate-950 border border-slate-800 hover:border-blue-700 rounded-lg px-3 py-2 transition-colors duration-150"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${t.kind === "sale" ? "bg-blue-950 text-blue-400 border border-blue-800/50" : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"}`}>
                      {t.kind === "sale" ? "Sale" : "Repair"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-200 truncate">{t.customerName || "Walk-in customer"}</p>
                      <p className="text-[9px] text-slate-500 font-mono">{new Date(t.date).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0 ml-2">{formatCurrency(t.total)}</span>
                </Link>
              ))}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-1.5">
            <IconAlert width={14} height={14} className="text-amber-400" />
            Low Stock Watchlist
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">Parts at or below their minimum threshold.</p>

          {metrics.lowStock.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                placeholder="Search..."
                value={watchlistSearch}
                onChange={(e) => setWatchlistSearch(e.target.value)}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              <select
                value={watchlistCategory}
                onChange={(e) => setWatchlistCategory(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-blue-500 font-mono shrink-0"
              >
                <option value="">All categories</option>
                {PART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {metrics.lowStock.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">Nothing flagged right now.</p>}
            {metrics.lowStock.length > 0 && filteredLowStock.length === 0 && (
              <p className="text-[11px] text-slate-600 font-mono py-4 text-center">No flagged parts match your search.</p>
            )}
            {filteredLowStock.map((p) => (
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
