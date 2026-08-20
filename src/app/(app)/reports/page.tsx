"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/session";
import {
  getMonthlyRevenue,
  getTopParts,
  getTopPartsForMonth,
  getMonthTransactions,
  getTopCustomers,
  monthLabel,
  type MonthlyRevenue,
  type TopPart,
  type MonthTransaction,
  type TopCustomer,
} from "@/lib/db/reports";
import { listParts } from "@/lib/db/parts";
import { listMotorcycles } from "@/lib/db/motorcycles";
import { computeStockMetrics } from "@/lib/stockMetrics";
import { formatCurrency } from "@/lib/format";
import { StatTile } from "@/components/ui/StatTile";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { CategoryValueChart } from "@/components/dashboard/CategoryValueChart";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconChart, IconBox, IconTag, IconUser, IconReceipt } from "@/components/ui/icons";

const MAX_RANGE_MONTHS = 240; // 20 years — a sane ceiling, not a preset

export default function ReportsPage() {
  const { shop, currentUser } = useAuth();
  // rangeMonths is the applied/committed value that actually drives the
  // fetch below. rangeValueInput/rangeUnit are the raw, freely-editable
  // controls the user types into — any number, either unit, no fixed list.
  const [rangeMonths, setRangeMonths] = useState<number>(6);
  const [rangeValueInput, setRangeValueInput] = useState("6");
  const [rangeUnit, setRangeUnit] = useState<"months" | "years">("months");
  const [months, setMonths] = useState<MonthlyRevenue[]>([]);
  const [topParts, setTopParts] = useState<TopPart[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [stock, setStock] = useState(() => computeStockMetrics([], []));

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthTopParts, setMonthTopParts] = useState<TopPart[]>([]);
  const [monthTransactions, setMonthTransactions] = useState<MonthTransaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const applyRange = useCallback(
    (valueStr: string, unit: "months" | "years") => {
      const n = Math.max(1, Math.min(unit === "years" ? MAX_RANGE_MONTHS / 12 : MAX_RANGE_MONTHS, Math.floor(Number(valueStr)) || 1));
      setRangeValueInput(String(n));
      setRangeMonths(unit === "years" ? n * 12 : n);
    },
    []
  );

  useEffect(() => {
    if (!shop) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    Promise.all([getMonthlyRevenue(shop.id, rangeMonths), getTopParts(shop.id, monthStart, 5), getTopCustomers(shop.id, monthStart, 5)]).then(([m, t, c]) => {
      setMonths(m);
      setTopParts(t);
      setTopCustomers(c);
      setLoading(false);
      setSelectedMonth(m[m.length - 1]?.month ?? null);
    });
  }, [shop, rangeMonths]);

  // Current inventory valuation — a snapshot of right now, independent of
  // the revenue date range above, so it doesn't need to reload every time
  // that changes.
  useEffect(() => {
    if (!shop) return;
    setStockLoading(true);
    Promise.all([listParts(shop.id), listMotorcycles(shop.id)]).then(([parts, motorcycles]) => {
      setStock(computeStockMetrics(parts, motorcycles));
      setStockLoading(false);
    });
  }, [shop]);

  const loadMonthDetail = useCallback(
    async (month: string) => {
      if (!shop) return;
      setDetailLoading(true);
      try {
        const [tp, tx] = await Promise.all([getTopPartsForMonth(shop.id, month, 5), getMonthTransactions(shop.id, month)]);
        setMonthTopParts(tp);
        setMonthTransactions(tx);
      } finally {
        setDetailLoading(false);
      }
    },
    [shop]
  );

  useEffect(() => {
    if (selectedMonth) loadMonthDetail(selectedMonth);
  }, [selectedMonth, loadMonthDetail]);

  const { current, prior, changePct } = useMemo(() => {
    const current = months[months.length - 1];
    const prior = months[months.length - 2];
    const changePct = prior && prior.total > 0 && current ? ((current.total - prior.total) / prior.total) * 100 : null;
    return { current, prior, changePct };
  }, [months]);

  const selectedMonthData = months.find((m) => m.month === selectedMonth) ?? null;
  const isCurrentMonth = selectedMonth === months[months.length - 1]?.month;

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
        Revenue from completed POS sales and finished repair jobs, by month. Click any month — on
        the chart or in the table — to see exactly which sales and jobs made up that total. Whole-
        motorcycle sales aren&apos;t counted yet — Showroom only tracks stock, not a dated sale — so
        this is parts + repairs only for now.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Sales Reports</h2>
        <p className="text-xs text-slate-400">How the shop is doing, month by month.</p>
      </div>

      <div className="flex items-center gap-2">
        <IconBox width={16} height={16} className="text-slate-400" />
        <div>
          <h3 className="text-sm font-bold text-white">Stock Asset Evaluation</h3>
          <p className="text-xs text-slate-400">What&apos;s sitting in inventory right now, valued at cost and at retail — separate from the revenue history below.</p>
        </div>
      </div>

      {stockLoading ? (
        <TableSkeleton rows={1} cols={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Inventory Cost" value={stock.totalCost} format="currency" accent="primary" />
          <StatTile label="Potential Retail Value" value={stock.totalRetail} format="currency" accent="primary" />
          <StatTile label="Potential Profit" value={stock.potentialProfit} format="currency" accent="blue" />
          <StatTile label="Low Stock Parts" value={stock.lowStock.length} accent="amber" suffix=" flagged" />
        </div>
      )}

      {!stockLoading && stock.chartData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Inventory Value by Category</h3>
          <p className="text-[11px] text-slate-500 mb-1">Retail value across parts and motorcycle categories, largest first.</p>
          <CategoryValueChart data={stock.chartData} />
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
        <IconChart width={16} height={16} className="text-slate-400" />
        <div>
          <h3 className="text-sm font-bold text-white">Revenue History</h3>
          <p className="text-xs text-slate-400">Completed sales and repair jobs, month by month.</p>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={1} cols={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatTile label="This Month" value={current?.total ?? 0} format="currency" accent="primary" />
          <StatTile label="Transactions" value={current?.transactionCount ?? 0} accent="primary" />
          <StatTile label="Avg. Transaction" value={current && current.transactionCount > 0 ? current.total / current.transactionCount : 0} format="currency" accent="primary" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Vs. Last Month</p>
            <p className={`text-2xl font-black mt-1 flex items-center gap-1 ${changePct === null ? "text-slate-500" : changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {changePct !== null && <span className="text-lg leading-none">{changePct >= 0 ? "▲" : "▼"}</span>}
              {changePct === null ? "—" : `${Math.abs(changePct).toFixed(1)}%`}
            </p>
          </div>
          <StatTile label="Repair Revenue Share" value={current && current.total > 0 ? Math.round((current.repairsRevenue / current.total) * 100) : 0} suffix="%" accent="primary" />
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Revenue, Last {rangeMonths >= 12 && rangeMonths % 12 === 0 ? `${rangeMonths / 12} Year${rangeMonths / 12 === 1 ? "" : "s"}` : `${rangeMonths} Months`}
            </h3>
            <p className="text-[11px] text-slate-500">Parts sales + completed repair jobs, combined. Click a month to drill in below.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Show last</span>
            <input
              type="number"
              min={1}
              value={rangeValueInput}
              onChange={(e) => setRangeValueInput(e.target.value)}
              onBlur={() => applyRange(rangeValueInput, rangeUnit)}
              onKeyDown={(e) => e.key === "Enter" && applyRange(rangeValueInput, rangeUnit)}
              className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <select
              value={rangeUnit}
              onChange={(e) => {
                const unit = e.target.value as "months" | "years";
                setRangeUnit(unit);
                applyRange(rangeValueInput, unit);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={4} cols={1} />
        ) : (
          <div className="overflow-x-auto mt-2">
            <div style={{ minWidth: rangeMonths > 12 ? `${rangeMonths * 42}px` : undefined }}>
              <MonthlyRevenueChart data={months} selectedMonth={selectedMonth ?? undefined} onSelectMonth={setSelectedMonth} />
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-auto max-h-[26rem]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-slate-900">
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
                <tr
                  key={m.month}
                  onClick={() => setSelectedMonth(m.month)}
                  className={`cursor-pointer transition-colors duration-150 ${selectedMonth === m.month ? "bg-blue-950/30" : "hover:bg-slate-800/40"}`}
                >
                  <td className={`px-4 py-2.5 font-bold ${selectedMonth === m.month ? "text-blue-300" : "text-slate-200"}`}>{monthLabel(m.month)}</td>
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

      {selectedMonthData && (
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">{monthLabel(selectedMonthData.month)} in Detail</h3>
          <p className="text-[11px] text-slate-500">Every sale and completed repair job behind that month&apos;s total — click one to open it.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <IconTag width={14} height={14} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
                Top Parts {isCurrentMonth ? "This Month" : selectedMonthData ? `— ${monthLabel(selectedMonthData.month)}` : ""}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">By revenue, POS sales only.</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {!detailLoading && monthTopParts.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">No sales that month.</p>}
              {(() => {
                const list = detailLoading ? topParts : monthTopParts;
                const maxRevenue = Math.max(1, ...list.map((p) => p.revenue));
                return list.map((p, i) => (
                  <div key={p.partNumber} className="relative bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-blue-500/10" style={{ width: `${Math.max(4, (p.revenue / maxRevenue) * 100)}%` }} />
                    <div className="relative flex items-center gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold font-mono flex items-center justify-center">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-200 truncate">{p.partName}</p>
                        <p className="text-[9px] text-slate-500 font-mono truncate">{p.qtySold} sold</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0">{formatCurrency(p.revenue)}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <IconUser width={14} height={14} className="text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Top Customers This Month</h3>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">By total spend, parts + repair jobs combined.</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {topCustomers.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">No customer-attributed sales yet this month.</p>}
              {(() => {
                const maxSpend = Math.max(1, ...topCustomers.map((c) => c.total));
                return topCustomers.map((c, i) => (
                  <Link
                    key={c.customerId}
                    href={`/customers/detail?customerId=${c.customerId}`}
                    className="relative block bg-slate-950 border border-slate-800 hover:border-blue-700 rounded-lg px-3 py-2 overflow-hidden transition-colors duration-150"
                  >
                    <div className="absolute inset-y-0 left-0 bg-blue-500/10" style={{ width: `${Math.max(4, (c.total / maxSpend) * 100)}%` }} />
                    <div className="relative flex items-center gap-2.5">
                      <span className="shrink-0 h-5 w-5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold font-mono flex items-center justify-center">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-200 truncate">{c.name}</p>
                        <p className="text-[9px] text-slate-500 font-mono truncate">{c.transactionCount} transaction{c.transactionCount === 1 ? "" : "s"}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0">{formatCurrency(c.total)}</span>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 mb-1">
            <IconReceipt width={14} height={14} className="text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Transactions</h3>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">{monthTransactions.length} sale{monthTransactions.length === 1 ? "" : "s"}/job{monthTransactions.length === 1 ? "" : "s"} that made up this month.</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {detailLoading && <p className="text-[11px] text-slate-500 font-mono py-4 text-center">Loading...</p>}
            {!detailLoading && monthTransactions.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-4 text-center">No transactions that month.</p>}
            {!detailLoading &&
              monthTransactions.map((t) => (
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
                      <p className="text-[9px] text-slate-500 font-mono">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0 ml-2">{formatCurrency(t.total)}</span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
