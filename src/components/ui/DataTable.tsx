"use client";

import React from "react";

export interface Column<T> {
  header: string;
  align?: "left" | "center" | "right";
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  emptyMessage: string;
}

const alignClass = { left: "text-left", center: "text-center", right: "text-right" } as const;

export function DataTable<T>({ columns, rows, keyExtractor, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
              {columns.map((col) => (
                <th key={col.header} className={`p-4 ${alignClass[col.align ?? "left"]}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {rows.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-slate-800/20 transition-all duration-150 group">
                {columns.map((col) => (
                  <td key={col.header} className={`p-4 ${alignClass[col.align ?? "left"]}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-slate-500 font-mono">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
