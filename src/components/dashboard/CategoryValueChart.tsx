"use client";

import React, { useState } from "react";

export interface CategoryValue {
  label: string;
  value: number;
}

/**
 * Ranked horizontal bar chart: one measure (retail value) by category, a
 * single series so one hue suffices — no legend needed, bars are
 * direct-labeled, and the largest bar sets the scale for the rest.
 */
export function CategoryValueChart({ data }: { data: CategoryValue[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...sorted.map((d) => d.value));

  if (sorted.length === 0) {
    return <p className="text-xs text-slate-500 font-mono py-8 text-center">No inventory value yet — add parts or motorcycles to see the breakdown.</p>;
  }

  return (
    <div className="space-y-3 mt-2" role="img" aria-label="Inventory value by category">
      {sorted.map((d) => {
        const pct = (d.value / max) * 100;
        const isHovered = hovered === d.label;
        return (
          <div
            key={d.label}
            className="group"
            onMouseEnter={() => setHovered(d.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span className={`transition-colors ${isHovered ? "text-white" : "text-slate-400"}`}>{d.label}</span>
              <span className={`font-bold tabular-nums transition-colors ${isHovered ? "text-blue-300" : "text-slate-300"}`}>
                ${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-800/60 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-blue-500 transition-all duration-700 ease-out ${isHovered ? "bg-blue-400" : ""}`}
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
