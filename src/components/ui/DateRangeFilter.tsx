"use client";

import React from "react";

interface DateRangeFilterProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

const dateInputClass =
  "bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 font-mono [color-scheme:dark]";

/** From/to date range, both optional. Used anywhere a list of dated
 * records (sales, repair jobs) needs to be narrowed to a specific window. */
export function DateRangeFilter({ from, to, onFromChange, onToChange }: DateRangeFilterProps) {
  const hasRange = Boolean(from || to);
  return (
    <div className="flex items-center gap-1.5">
      <input type="date" value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} className={dateInputClass} />
      <span className="text-slate-600 text-[10px] font-mono">to</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} className={dateInputClass} />
      {hasRange && (
        <button
          onClick={() => {
            onFromChange("");
            onToChange("");
          }}
          title="Clear date range"
          className="text-[10px] font-mono text-slate-500 hover:text-slate-300 px-1.5 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
