"use client";

import React, { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth/session";
import { listParts } from "@/lib/db/parts";
import type { Part } from "@/types";
import { getCached, setCached } from "@/lib/db/cache";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconPrinter, IconTag } from "@/components/ui/icons";

export default function LabelsPage() {
  const { shop, track } = useAuth();
  const [parts, setParts] = useState<Part[]>(() => (shop && getCached<Part[]>(`parts:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`parts:${shop.id}`)));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qrCache, setQrCache] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!shop) return;
    listParts(shop.id).then((p) => {
      setCached(`parts:${shop.id}`, p);
      setParts(p);
      setLoading(false);
    });
  }, [shop]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return parts.filter((p) => p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q));
  }, [parts, search]);

  const selectedParts = parts.filter((p) => selected.has(p.id));

  // Generate (and cache) a QR code data URL per selected part. The QR payload
  // is the raw part number — a keyboard-wedge scanner types it straight into
  // the POS / Repair Jobs search boxes, which already match on part number.
  useEffect(() => {
    const missing = selectedParts.filter((p) => !qrCache.has(p.id));
    if (missing.length === 0) return;
    (async () => {
      const next = new Map(qrCache);
      for (const p of missing) {
        next.set(p.id, await QRCode.toDataURL(p.partNumber, { margin: 1, width: 160, color: { dark: "#0f172a", light: "#ffffff" } }));
      }
      setQrCache(next);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => setSelected(new Set(filtered.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="labels">
        Select the parts you want labels for, then print. Each label shows a scannable QR code
        alongside the part name and part number in plain text, so it&apos;s readable even without
        a scanner. A keyboard-wedge scanner can read the code straight into POS or a repair job
        search box.
      </HelpTip>

      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <IconTag width={18} height={18} className="text-slate-300" /> QR Labels
          </h2>
          <p className="text-xs text-slate-400">Pick parts, then print a sheet of scannable QR labels for the shelf/bin.</p>
        </div>
        <Button disabled={selected.size === 0} onClick={() => { track("labels_printed", { count: selected.size }); window.print(); }}>
          <IconPrinter width={14} height={14} /> Print {selected.size > 0 ? `${selected.size} Label${selected.size === 1 ? "" : "s"}` : "Labels"}
        </Button>
      </div>

      <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search parts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button onClick={selectAllFiltered} className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg whitespace-nowrap">Select All</button>
            <button onClick={clearSelection} className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg whitespace-nowrap">Clear</button>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-h-[28rem] overflow-y-auto divide-y divide-slate-800/60">
              {filtered.map((p) => (
                <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40 cursor-pointer text-xs">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="accent-blue-500 w-3.5 h-3.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 font-bold truncate">{p.partName}</p>
                    <p className="text-[10px] font-mono text-slate-500 truncate">{p.partNumber}</p>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && <p className="text-center text-[11px] text-slate-600 font-mono py-8">No parts match your search.</p>}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Preview</h3>
          {selectedParts.length === 0 ? (
            <p className="text-center text-[11px] text-slate-600 font-mono py-8">Select parts on the left to preview their labels.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-h-[26rem] overflow-y-auto pr-1">
              {selectedParts.map((p) => (
                <LabelCard key={p.id} part={p} qrDataUrl={qrCache.get(p.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print-only label sheet */}
      <div className="hidden print:grid grid-cols-3 gap-3">
        {selectedParts.map((p) => (
          <LabelCard key={p.id} part={p} qrDataUrl={qrCache.get(p.id)} printMode />
        ))}
      </div>
    </div>
  );
}

function LabelCard({ part, qrDataUrl, printMode = false }: { part: Part; qrDataUrl?: string; printMode?: boolean }) {
  // Printed labels favor legibility over density: a bigger code so it still
  // scans after printing, and the part name/number spelled out underneath so
  // the label is identifiable at a glance even without scanning it.
  return (
    <div className={`flex flex-col items-center text-center gap-1.5 border rounded-lg p-3 ${printMode ? "border-slate-400 break-inside-avoid" : "border-slate-800 bg-slate-950"}`}>
      {qrDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrDataUrl} alt={`QR code for ${part.partNumber}`} className={printMode ? "w-24 h-24" : "w-16 h-16"} />
      ) : (
        <div className={`${printMode ? "w-24 h-24" : "w-16 h-16"} bg-slate-800 animate-pulse rounded`} />
      )}
      <div className="min-w-0 w-full">
        <p className={`font-bold truncate ${printMode ? "text-sm text-slate-900" : "text-xs text-slate-200"}`}>{part.partName}</p>
        <p className={`font-mono truncate ${printMode ? "text-xs text-slate-600" : "text-[10px] text-slate-500"}`}>{part.partNumber}</p>
      </div>
    </div>
  );
}
