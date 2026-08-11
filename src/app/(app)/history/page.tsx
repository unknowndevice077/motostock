"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/session";
import { listSalesWithItems } from "@/lib/db/sales";
import type { Sale } from "@/types";
import { formatCurrency } from "@/lib/format";
import { isWithinDateRange } from "@/lib/dateRange";
import { getCached, setCached } from "@/lib/db/cache";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { IconHistory } from "@/components/ui/icons";

export default function HistoryPage() {
  const { shop } = useAuth();
  const [sales, setSales] = useState<Sale[]>(() => (shop && getCached<Sale[]>(`sales:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`sales:${shop.id}`)));
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!shop) return;
    listSalesWithItems(shop.id).then((s) => {
      setCached(`sales:${shop.id}`, s);
      setSales(s);
      setLoading(false);
    });
  }, [shop]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      const matchesQuery =
        !q ||
        (s.customerName ?? "").toLowerCase().includes(q) ||
        s.items.some((i) => i.partName.toLowerCase().includes(q) || i.partNumber.toLowerCase().includes(q));
      return matchesQuery && isWithinDateRange(s.createdAt, dateFrom, dateTo);
    });
  }, [sales, search, dateFrom, dateTo]);

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="history">
        Every POS sale, most recent first — search by customer name or by part, or narrow to a
        specific date range. Click a sale to reprint its receipt. Repair jobs have their own
        search and date filter too, on the Repair Jobs page.
      </HelpTip>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <IconHistory width={18} height={18} className="text-slate-300" /> Purchase History
          </h2>
          <p className="text-xs text-slate-400">What was bought, by whom, and when.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search customer or part..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-w-[220px] transition-all duration-200"
          />
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={3} />
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
          <p className="text-xs text-slate-500 font-mono">
            {sales.length === 0 ? "No sales recorded yet." : "No sales match your search or date range."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sale) => (
            <Link
              key={sale.id}
              href={`/pos/receipt?saleId=${sale.id}`}
              className="block bg-slate-900 border border-slate-800 hover:border-blue-700 rounded-xl p-4 transition-all duration-150"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{sale.customerName || "Walk-in customer"}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{new Date(sale.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-slate-200">{formatCurrency(sale.total)}</p>
                  <p className="text-[9px] text-slate-500 font-mono">{sale.items.length} item{sale.items.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                {sale.items.map((item) => (
                  <span key={item.id} className="text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
                    {item.partName} &times;{item.qty}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
