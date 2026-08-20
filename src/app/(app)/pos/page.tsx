"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { useScan } from "@/lib/sync/ScanProvider";
import { listParts } from "@/lib/db/parts";
import { createSale, type CartLine } from "@/lib/db/sales";
import { listRepairJobs, addPartToJob } from "@/lib/db/repairJobs";
import type { Part, RepairJob, Customer } from "@/types";
import { formatCurrency } from "@/lib/format";
import { getCached, setCached } from "@/lib/db/cache";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { CustomerPicker } from "@/components/ui/CustomerPicker";
import { IconCart, IconTrash, IconWrench, IconPlus, IconMinus, IconX } from "@/components/ui/icons";

type Mode = "sale" | "repair";

/** One held counter-sale-in-progress: its own cart and customer, kept
 * separate from every other open order so staff can hop between several
 * customers (e.g. one's still deciding while another's ready to pay)
 * without anything getting lost or mixed up. Lives only in memory for the
 * current POS session — nothing is written to the database until checkout. */
interface Ticket {
  id: string;
  customer: Customer | null;
  cart: CartLine[];
}

function newTicket(): Ticket {
  return { id: crypto.randomUUID(), customer: null, cart: [] };
}

export default function PosPage() {
  const { shop, currentUser, track } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("sale");
  const [parts, setParts] = useState<Part[]>(() => (shop && getCached<Part[]>(`parts:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`parts:${shop.id}`)));
  const [query, setQuery] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Counter-sale tickets (one or more customers' carts, see Ticket above).
  const [tickets, setTickets] = useState<Ticket[]>(() => [newTicket()]);
  const [activeTicketId, setActiveTicketId] = useState<string>(() => tickets[0].id);
  const activeTicket = tickets.find((t) => t.id === activeTicketId) ?? tickets[0];

  // Repair-job mode has its own single cart — it's already scoped to one
  // job at a time via the picker below, so it doesn't need multiple tabs.
  const [repairCart, setRepairCart] = useState<CartLine[]>([]);

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

  // Switching to/from Repair Job mode resets that side only — the counter-
  // sale tickets are untouched either way, so nothing there is ever lost by
  // glancing at a repair job.
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setRepairCart([]);
    setSelectedJobId("");
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts.slice(0, 24);
    return parts.filter((p) => p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)).slice(0, 24);
  }, [parts, query]);

  const cart = mode === "sale" ? activeTicket.cart : repairCart;
  const total = cart.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);

  const applyToCart = (prevCart: CartLine[], part: Part): CartLine[] | null => {
    const existing = prevCart.find((l) => l.partId === part.id);
    if (existing) {
      if (existing.qty >= part.stock) {
        push("error", `Only ${part.stock} in stock.`);
        return null;
      }
      return prevCart.map((l) => (l.partId === part.id ? { ...l, qty: l.qty + 1 } : l));
    }
    return [...prevCart, { partId: part.id, partName: part.partName, partNumber: part.partNumber, qty: 1, unitPrice: part.sellingPrice }];
  };

  const addToCart = (part: Part) => {
    if (part.stock <= 0) {
      push("error", `${part.partName} is out of stock.`);
      return;
    }
    if (mode === "sale") {
      const targetId = activeTicketId;
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== targetId) return t;
          const next = applyToCart(t.cart, part);
          return next ? { ...t, cart: next } : t;
        })
      );
    } else {
      setRepairCart((prev) => applyToCart(prev, part) ?? prev);
    }
    setQuery("");
    searchRef.current?.focus();
  };

  const setQty = (partId: string, qty: number) => {
    const part = parts.find((p) => p.id === partId);
    const clamped = Math.max(1, Math.min(qty, part?.stock ?? qty));
    if (mode === "sale") {
      const targetId = activeTicketId;
      setTickets((prev) => prev.map((t) => (t.id === targetId ? { ...t, cart: t.cart.map((l) => (l.partId === partId ? { ...l, qty: clamped } : l)) } : t)));
    } else {
      setRepairCart((prev) => prev.map((l) => (l.partId === partId ? { ...l, qty: clamped } : l)));
    }
  };

  const removeLine = (partId: string) => {
    if (mode === "sale") {
      const targetId = activeTicketId;
      setTickets((prev) => prev.map((t) => (t.id === targetId ? { ...t, cart: t.cart.filter((l) => l.partId !== partId) } : t)));
    } else {
      setRepairCart((prev) => prev.filter((l) => l.partId !== partId));
    }
  };

  const setActiveCustomer = (customer: Customer | null) => {
    const targetId = activeTicketId;
    setTickets((prev) => prev.map((t) => (t.id === targetId ? { ...t, customer } : t)));
  };

  const handleNewOrder = () => {
    const t = newTicket();
    setTickets((prev) => [...prev, t]);
    setActiveTicketId(t.id);
  };

  const handleCloseTicket = (id: string) => {
    const remaining = tickets.filter((t) => t.id !== id);
    const nextTickets = remaining.length > 0 ? remaining : [newTicket()];
    setTickets(nextTickets);
    if (id === activeTicketId) setActiveTicketId(nextTickets[0].id);
  };

  // Phone-scanner integration: while a sale/job cart is actually open here,
  // every live scan (see ScanProvider) drops straight into it, same as
  // clicking the matching search result — but only when the scan was
  // targeted correctly: a general (no-job) scan belongs in the active
  // counter-sale ticket, and a job-targeted scan only belongs in that exact
  // job's cart (staff pick the job on the phone itself, see
  // supabase/functions/scan-relay).
  const { onScan } = useScan();
  useEffect(() => {
    return onScan((event) => {
      if (mode === "sale" && event.repairJobId) return;
      if (mode === "repair" && event.repairJobId !== selectedJobId) return;
      const part = parts.find((p) => p.partNumber === event.partNumber);
      if (part) addToCart(part);
    });
  }, [onScan, mode, selectedJobId, activeTicketId, parts]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckout = async () => {
    if (!shop || activeTicket.cart.length === 0) return;
    setCheckingOut(true);
    try {
      const sale = await createSale(shop.id, currentUser?.id ?? null, activeTicket.customer?.id ?? null, activeTicket.customer?.name ?? null, activeTicket.cart);
      track("sale_completed", { total: sale.total, itemCount: activeTicket.cart.length });
      push("success", `Sale completed — ${formatCurrency(sale.total)}`);

      const idx = tickets.findIndex((t) => t.id === activeTicketId);
      const remaining = tickets.filter((t) => t.id !== activeTicketId);
      const nextTickets = remaining.length > 0 ? remaining : [newTicket()];
      const nextActive = remaining[Math.max(0, idx - 1)] ?? nextTickets[0];
      setTickets(nextTickets);
      setActiveTicketId(nextActive.id);

      router.push(`/pos/receipt?saleId=${sale.id}`);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAddToJob = async () => {
    if (!selectedJobId || repairCart.length === 0) return;
    setCheckingOut(true);
    try {
      for (const line of repairCart) {
        await addPartToJob(selectedJobId, line.partId, line.partName, line.partNumber, line.qty, line.unitPrice);
      }
      track("repair_job_parts_added_from_pos", { jobId: selectedJobId, total, itemCount: repairCart.length });
      push("success", `Parts added to job — ${formatCurrency(total)}`);
      setRepairCart([]);
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
        Helping more than one customer at once? Click <strong>New Order</strong> to start another
        tab and switch back to any of them anytime before checkout — nothing is lost.
      </HelpTip>

      <div className="flex flex-col gap-3">
        <div className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800 w-fit">
          <button onClick={() => switchMode("sale")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${mode === "sale" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            <IconCart width={13} height={13} /> Counter Sale
          </button>
          <button onClick={() => switchMode("repair")} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${mode === "repair" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            <IconWrench width={13} height={13} /> Repair Job
          </button>
        </div>

        {mode === "sale" && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {tickets.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setActiveTicketId(t.id)}
                className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg text-xs font-mono transition-all duration-150 ${
                  t.id === activeTicketId ? "bg-slate-800 text-white border border-slate-700" : "bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700"
                }`}
              >
                <span className="truncate max-w-[9rem]">{t.customer?.name || `Walk-in ${i + 1}`}</span>
                {t.cart.length > 0 && <span className="text-[9px] text-slate-500">({t.cart.length})</span>}
                {t.cart.length === 0 && tickets.length > 1 && (
                  <span
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTicket(t.id);
                    }}
                    className="text-slate-600 hover:text-red-400"
                  >
                    <IconX width={10} height={10} />
                  </span>
                )}
              </button>
            ))}
            <button onClick={handleNewOrder} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-500 hover:text-slate-300 border border-dashed border-slate-800 hover:border-slate-600 transition-all duration-150">
              <IconPlus width={11} height={11} /> New Order
            </button>
          </div>
        )}
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
            onKeyDown={(e) => {
              // A USB/keyboard-wedge QR scanner types the code then sends
              // Enter — this makes that a real one-motion scan-to-cart
              // instead of requiring a click after every scan, same as the
              // phone scanner already does live.
              if (e.key !== "Enter") return;
              const q = query.trim().toLowerCase();
              if (!q) return;
              const exact = parts.find((p) => p.partNumber.toLowerCase() === q);
              if (exact) addToCart(exact);
            }}
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono truncate">
              {mode === "sale" ? (activeTicket.customer?.name ? `${activeTicket.customer.name}'s Order` : "Current Sale") : selectedJob ? `${selectedJob.customerName}'s Job` : "Job Cart"}
            </h3>
            <span className="ml-auto text-[10px] font-mono text-slate-500 shrink-0">{cart.length} item{cart.length === 1 ? "" : "s"}</span>
          </div>

          <div className="flex-1 max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {cart.length === 0 && <p className="text-center text-[11px] text-slate-600 font-mono py-10">{mode === "sale" ? "Cart is empty" : "No parts added yet"}</p>}
            {cart.map((line) => (
              <div key={line.partId} className="p-3 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{line.partName}</p>
                  <p className="text-[10px] font-mono text-slate-500">{formatCurrency(line.unitPrice)} ea</p>
                </div>
                <div className="flex items-center border border-slate-800 rounded overflow-hidden shrink-0">
                  <button
                    onClick={() => setQty(line.partId, line.qty - 1)}
                    className="px-1.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
                  >
                    <IconMinus width={11} height={11} />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => setQty(line.partId, Number(e.target.value) || 1)}
                    className="w-9 bg-slate-950 py-1 text-xs text-center font-mono text-slate-200 focus:outline-none"
                  />
                  <button
                    onClick={() => setQty(line.partId, line.qty + 1)}
                    className="px-1.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
                  >
                    <IconPlus width={11} height={11} />
                  </button>
                </div>
                <button onClick={() => removeLine(line.partId)} className="text-red-400 hover:text-red-300 shrink-0">
                  <IconTrash width={14} height={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 space-y-3">
            {mode === "sale" && shop && (
              <CustomerPicker shopId={shop.id} value={activeTicket.customer} onChange={setActiveCustomer} />
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
