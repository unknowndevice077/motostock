"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { getMonthlyRevenue, getTopParts, monthLabel, type MonthlyRevenue, type TopPart } from "@/lib/db/reports";
import { formatCurrency } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";

const MONTHS_SHOWN = 6;

export default function ReportsPage() {
  const { shop, currentUser } = useAuth();
  const [months, setMonths] = useState<MonthlyRevenue[]>([]);
  const [topParts, setTopParts] = useState<TopPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shop) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    Promise.all([getMonthlyRevenue(shop.id, MONTHS_SHOWN), getTopParts(shop.id, monthStart, 5)]).then(([m, t]) => {
      setMonths(m);
      setTopParts(t);
      setLoading(false);
    });
  }, [shop]);

  const { current, prior, changePct } = useMemo(() => {
    const current = months[months.length - 1];
    const prior = months[months.length - 2];
    const changePct = prior && prior.total > 0 && current ? ((current.total - prior.total) / prior.total) * 100 : null;
    return { current, prior, changePct };
  }, [months]);

  if (currentUser?.role !== "admin") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <p className="text-sm font-bold text-slate-300">Shop owners only</p>
        <p className="text-xs text-slate-500 mt-1">Sales figures aren&apos;t visible to staff accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="reports">
        Revenue from completed POS sales and finished repair jobs, by month. Whole-motorcycle
        sales aren&apos;t counted yet — Showroom only tracks stock, not a dated sale — so this is
        parts + repairs only for now.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Sales Reports</h2>
        <p className="text-xs text-slate-400">How the shop is doing, month by month.</p>
      </div>

      {loading ? (
        <TableSkeleton rows={1} cols={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="This Month" value={current?.total ?? 0} format="currency" accent="primary" />
          <StatTile label="Transactions" value={current?.transactionCount ?? 0} accent="primary" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Vs. Last Month</p>
            <p className={`text-2xl font-black mt-1 ${changePct === null ? "text-slate-500" : changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {changePct === null ? "—" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%`}
            </p>
          </div>
          <StatTile label="Repair Revenue Share" value={current && current.total > 0 ? Math.round((current.repairsRevenue / current.total) * 100) : 0} suffix="%" accent="primary" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Revenue, Last {MONTHS_SHOWN} Months</h3>
          <p className="text-[11px] text-slate-500 mb-1">Parts sales + completed repair jobs, combined.</p>
          {loading ? <TableSkeleton rows={4} cols={1} /> : <MonthlyRevenueChart data={months} />}
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Top Parts This Month</h3>
          <p className="text-[11px] text-slate-500 mb-3">By revenue, POS sales only.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {!loading && topParts.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">No sales yet this month.</p>}
            {topParts.map((p) => (
              <div key={p.partNumber} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-200 truncate">{p.partName}</p>
                  <p className="text-[9px] text-slate-500 font-mono truncate">{p.qtySold} sold</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0 ml-2">{formatCurrency(p.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase font-mono text-slate-500">
                <th className="px-4 py-2.5 font-medium">Month</th>
                <th className="px-4 py-2.5 font-medium text-right">Parts Sales</th>
                <th className="px-4 py-2.5 font-medium text-right">Repair Jobs</th>
                <th className="px-4 py-2.5 font-medium text-right">Total</th>
                <th className="px-4 py-2.5 font-medium text-right">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {months.slice().reverse().map((m) => (
                <tr key={m.month}>
                  <td className="px-4 py-2.5 font-bold text-slate-200">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{formatCurrency(m.partsRevenue)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">{formatCurrency(m.repairsRevenue)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-200">{formatCurrency(m.total)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-400">{m.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
