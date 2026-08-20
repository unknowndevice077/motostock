"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { useScan } from "@/lib/sync/ScanProvider";
import { listParts } from "@/lib/db/parts";
import { createSale, type CartLine } from "@/lib/db/sales";
import { listRepairJobs, addPartToJob } from "@/lib/db/repairJobs";
import type { Part, RepairJob } from "@/types";
import { formatCurrency } from "@/lib/format";
import { getCached, setCached } from "@/lib/db/cache";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconCart, IconTrash, IconWrench } from "@/components/ui/icons";

type Mode = "sale" | "repair";

export default function PosPage() {
  const { shop, currentUser, track } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("sale");
  const [parts, setParts] = useState<Part[]>(() => (shop && getCached<Part[]>(`parts:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`parts:${shop.id}`)));
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [openJobs, setOpenJobs] = useState<RepairJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");

  useEffect(() => {
    if (!shop) return;
    listParts(shop.id).then((p) => {
      setCached(`parts:${shop.id}`, p);
      setParts(p);
      setLoading(false);
    });
    searchRef.current?.focus();
  }, [shop]);

  useEffect(() => {
    if (!shop || mode !== "repair") return;
    setJobsLoading(true);
    listRepairJobs(shop.id).then((jobs) => {
      const open = jobs.filter((j) => j.status !== "completed");
      setOpenJobs(open);
      setJobsLoading(false);
    });
  }, [shop, mode]);

  // Switching modes starts a fresh cart — a repair job's parts list and a
  // walk-in sale are two different receipts and shouldn't mix.
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setCart([]);
    setSelectedJobId("");
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts.slice(0, 24);
    return parts.filter((p) => p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)).slice(0, 24);
  }, [parts, query]);

  const total = cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  const addToCart = (part: Part) => {
    if (part.stock <= 0) {
      push("error", `${part.partName} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.partId === part.id);
      if (existing) {
        if (existing.qty >= part.stock) {
          push("error", `Only ${part.stock} in stock.`);
          return prev;
        }
        return prev.map((l) => (l.partId === part.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { partId: part.id, partName: part.partName, partNumber: part.partNumber, qty: 1, unitPrice: part.sellingPrice }];
    });
    setQuery("");
    searchRef.current?.focus();
  };

  const setQty = (partId: string, qty: number) => {
    const part = parts.find((p) => p.id === partId);
    const clamped = Math.max(1, Math.min(qty, part?.stock ?? qty));
    setCart((prev) => prev.map((l) => (l.partId === partId ? { ...l, qty: clamped } : l)));
  };

  const removeLine = (partId: string) => setCart((prev) => prev.filter((l) => l.partId !== partId));

  // Phone-scanner integration: while a sale/job cart is actually open here,
  // every live scan (see ScanProvider) drops straight into it, same as
  // clicking the matching search result. Repair mode without a job selected
  // is left alone, matching the disabled search/add-to-cart state above.
  const { onScan } = useScan();
  useEffect(() => {
    return onScan((event) => {
      if (mode === "repair" && !selectedJobId) return;
      const part = parts.find((p) => p.partNumber === event.partNumber);
      if (part) addToCart(part);
    });
  }, [onScan, mode, selectedJobId, parts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = async () => {
    if (!shop || cart.length === 0) return;
    setCheckingOut(true);
    try {
      const sale = await createSale(shop.id, currentUser?.id ?? null, customerName.trim() || null, cart);
      track("sale_completed", { total: sale.total, itemCount: cart.length });
      push("success", `Sale completed — ${formatCurrency(sale.total)}`);
      setCart([]);
      setCustomerName("");
      router.push(`/pos/receipt?saleId=${sale.id}`);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAddToJob = async () => {
    if (!selectedJobId || cart.length === 0) return;
    setCheckingOut(true);
    try {
      for (const line of cart) {
        await addPartToJob(selectedJobId, line.partId, line.partName, line.partNumber, line.qty, line.unitPrice);
      }
      track("repair_job_parts_added_from_pos", { jobId: selectedJobId, total, itemCount: cart.length });
      push("success", `Parts added to job — ${formatCurrency(total)}`);
      setCart([]);
      router.push(`/repairs/detail?jobId=${selectedJobId}`);
    } finally {
      setCheckingOut(false);
    }
  };

  const selectedJob = openJobs.find((j) => j.id === selectedJobId) ?? null;

  return (
    <div className="space-y-4 animate-slideUp h-full">
      <HelpTip id="pos">
        Search or scan a part to add it to the cart. Use <strong>Counter Sale</strong> for a
        walk-in purchase and a printable receipt, or switch to <strong>Repair Job</strong> to
        charge parts against a job that&apos;s already open — stock is deducted either way.
      </HelpTip>

      <div className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800 w-fit">
        <button onClick={() => switchMode("sale")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${mode === "sale" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
          <IconCart width={13} height={13} /> Counter Sale
        </button>
        <button onClick={() => switchMode("repair")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${mode === "repair" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
          <IconWrench width={13} height={13} /> Repair Job
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">{mode === "sale" ? "Point of Sale" : "Charge Parts to a Repair Job"}</h2>
            <p className="text-xs text-slate-400">{mode === "sale" ? "Search or scan a part to add it to the sale." : "Pick the job below, then search or scan parts to add to it."}</p>
          </div>

          {mode === "repair" && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
              {jobsLoading ? (
                <p className="text-[11px] text-slate-500 font-mono">Loading open jobs...</p>
              ) : openJobs.length === 0 ? (
                <p className="text-[11px] text-slate-500 font-mono">No open repair jobs. Create one from the Repairs page first.</p>
              ) : (
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="">Select a repair job...</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.customerName}{j.motorcycleDesc ? ` — ${j.motorcycleDesc}` : ""} ({j.status === "in_progress" ? "In Progress" : "Open"})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <input
            ref={searchRef}
            type="text"
            autoFocus
            placeholder="Scan or search part name / number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={mode === "repair" && !selectedJobId}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition-all duration-200 disabled:opacity-40"
          />

          {loading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.stock <= 0 || (mode === "repair" && !selectedJobId)}
                  className="text-left bg-slate-900 border border-slate-800 hover:border-blue-700 disabled:opacity-40 disabled:pointer-events-none rounded-lg p-3 transition-all duration-150 hover:-translate-y-0.5"
                >
                  <p className="text-xs font-bold text-white truncate">{p.partName}</p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">{p.partNumber}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-mono font-bold text-slate-200">{formatCurrency(p.sellingPrice)}</span>
                    <span className="text-[9px] font-mono text-slate-500">{p.stock} in stock</span>
                  </div>
                </button>
              ))}
              {results.length === 0 && <p className="col-span-full text-center text-xs text-slate-500 font-mono py-8">No parts match &quot;{query}&quot;.</p>}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col h-fit sticky top-6">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            {mode === "sale" ? <IconCart width={16} height={16} className="text-slate-400" /> : <IconWrench width={16} height={16} className="text-slate-400" />}
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">{mode === "sale" ? "Current Sale" : selectedJob ? `${selectedJob.customerName}'s Job` : "Job Cart"}</h3>
            <span className="ml-auto text-[10px] font-mono text-slate-500">{cart.length} item{cart.length === 1 ? "" : "s"}</span>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {cart.length === 0 && <p className="text-center text-[11px] text-slate-600 font-mono py-10">{mode === "sale" ? "Cart is empty" : "No parts added yet"}</p>}
            {cart.map((line) => (
              <div key={line.partId} className="p-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{line.partName}</p>
                  <p className="text-[10px] font-mono text-slate-500">{formatCurrency(line.unitPrice)} ea</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={(e) => setQty(line.partId, Number(e.target.value) || 1)}
                  className="w-14 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-center font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
                <button onClick={() => removeLine(line.partId)} className="text-red-400 hover:text-red-300 shrink-0">
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 space-y-3">
            {mode === "sale" && (
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400 font-mono uppercase text-[11px]">Total</span>
              <span className="text-xl font-black text-white">{formatCurrency(total)}</span>
            </div>
            {mode === "sale" ? (
              <Button className="w-full" disabled={cart.length === 0} loading={checkingOut} onClick={handleCheckout}>
                Checkout & Print Receipt
              </Button>
            ) : (
              <Button className="w-full" disabled={cart.length === 0 || !selectedJobId} loading={checkingOut} onClick={handleAddToJob}>
                Add to Job & Open Invoice
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
