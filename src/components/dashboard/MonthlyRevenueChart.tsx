"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { monthLabel, type MonthlyRevenue } from "@/lib/db/reports";

/**
 * Vertical bar chart, one bar per month — the right form for "change over
 * time" with a single series. One hue, direct-labeled bars, recessive track,
 * no axis lines needed since every value is labeled. Bars double as month
 * filters: click one to drill into that month's report below.
 */
export function MonthlyRevenueChart({
  data,
  selectedMonth,
  onSelectMonth,
}: {
  data: MonthlyRevenue[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.total));
  const hasAny = data.some((d) => d.total > 0);

  if (!hasAny) {
    return <p className="text-xs text-slate-500 font-mono py-8 text-center">No sales recorded yet — completed POS sales and repair jobs will show up here.</p>;
  }

  return (
    <div className="flex items-end gap-3 mt-4" role="img" aria-label="Monthly revenue, last six months — click a month to see its detail">
      {data.map((d) => {
        const pct = (d.total / max) * 100;
        const isHovered = hovered === d.month;
        const isSelected = selectedMonth === d.month;
        return (
          <button
            key={d.month}
            type="button"
            onClick={() => onSelectMonth?.(d.month)}
            className="flex-1 flex flex-col items-center gap-1.5 focus:outline-none"
            onMouseEnter={() => setHovered(d.month)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className={`text-[10px] font-mono font-bold tabular-nums transition-colors ${isHovered || isSelected ? "text-blue-300" : "text-slate-500"}`}>
              {d.total > 0 ? formatCurrency(d.total) : ""}
            </span>
            <div className={`w-full h-32 rounded-t-md flex items-end overflow-hidden transition-colors ${isSelected ? "bg-slate-700/80" : "bg-slate-800/60"}`}>
              <div
                className={`w-full rounded-t-md transition-all duration-700 ease-out ${isSelected ? "bg-blue-300" : isHovered ? "bg-blue-400" : "bg-blue-500"}`}
                style={{ height: `${d.total > 0 ? Math.max(3, pct) : 0}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono transition-colors ${isSelected ? "text-white font-bold" : isHovered ? "text-white" : "text-slate-500"}`}>
              {monthLabel(d.month)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
