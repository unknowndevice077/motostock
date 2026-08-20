"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/format";
import { monthLabel, type MonthlyRevenue } from "@/lib/db/reports";

/**
 * Stacked vertical bar chart, one bar per month — parts revenue and repair
 * revenue segments stacked within each bar, so the trend AND the sales mix
 * are both visible at a glance instead of needing the table below to see
 * the split. Bars double as month filters: click one to drill into that
 * month's report below.
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
    <div>
      <div className="flex items-center gap-4 mb-3">
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-blue-500" /> Parts
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Repairs
        </span>
      </div>
      <div className="flex items-end gap-3" role="img" aria-label="Monthly revenue, parts vs repairs — click a month to see its detail">
        {data.map((d) => {
          const partsPct = (d.partsRevenue / max) * 100;
          const repairsPct = (d.repairsRevenue / max) * 100;
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
              <div className={`w-full h-32 rounded-t-md flex flex-col justify-end overflow-hidden transition-colors ${isSelected ? "bg-slate-700/80" : "bg-slate-800/60"}`}>
                {/* Parts segment sits visually on top of repairs — rounds the
                    stack's top corners whenever it's present. */}
                <div
                  className={`w-full rounded-t-md transition-all duration-700 ease-out ${isHovered || isSelected ? "bg-blue-400" : "bg-blue-500"}`}
                  style={{ height: `${partsPct}%` }}
                />
                {/* Repairs segment is always flush against the bottom; it
                    only needs the rounded top corners itself when there's no
                    parts segment above it to own that rounding instead. */}
                <div
                  className={`w-full transition-all duration-700 ease-out ${isHovered || isSelected ? "bg-emerald-400" : "bg-emerald-500"} ${partsPct === 0 ? "rounded-t-md" : ""}`}
                  style={{ height: `${repairsPct}%` }}
                />
              </div>
              <span className={`text-[10px] font-mono transition-colors ${isSelected ? "text-white font-bold" : isHovered ? "text-white" : "text-slate-500"}`}>
                {monthLabel(d.month)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
