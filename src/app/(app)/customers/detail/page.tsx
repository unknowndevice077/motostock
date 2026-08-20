"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { getCustomer } from "@/lib/db/customers";
import { getCustomerTransactions, type MonthTransaction } from "@/lib/db/reports";
import type { Customer } from "@/types";
import { formatCurrency } from "@/lib/format";
import { HelpTip } from "@/components/ui/HelpTip";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { IconArrowLeft, IconUser } from "@/components/ui/icons";

function CustomerDetailContent() {
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId");
  const { shop } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<MonthTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId || !shop) return;
    setLoading(true);
    Promise.all([getCustomer(customerId), getCustomerTransactions(shop.id, customerId)]).then(([c, tx]) => {
      setCustomer(c);
      setTransactions(tx);
      setLoading(false);
    });
  }, [customerId, shop]);

  const totalSpent = transactions.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <HelpTip id="customer-detail">
        Every sale and repair job tied to this customer, newest first — click one to reopen its
        receipt or job.
      </HelpTip>

      <Link href="/repairs" className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors duration-150">
        <IconArrowLeft width={12} height={12} /> Back
      </Link>

      {loading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : !customer ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
          <p className="text-xs text-slate-500 font-mono">Customer not found.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <IconUser width={20} height={20} className="text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">{customer.name}</h2>
              <p className="text-xs text-slate-400 font-mono">{customer.phone || "No phone on file"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] uppercase font-mono text-slate-500">Total Spent</p>
              <p className="text-xl font-black text-white mt-1">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] uppercase font-mono text-slate-500">Transactions</p>
              <p className="text-xl font-black text-white mt-1">{transactions.length}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">History</h3>
            {transactions.length === 0 && <p className="text-center text-[11px] text-slate-600 font-mono py-8">No purchases or repair jobs yet.</p>}
            {transactions.map((t) => (
              <Link
                key={`${t.kind}-${t.id}`}
                href={t.kind === "sale" ? `/pos/receipt?saleId=${t.id}` : `/repairs/detail?jobId=${t.id}`}
                className="flex items-center justify-between bg-slate-950 border border-slate-800 hover:border-blue-700 rounded-lg px-3 py-2 transition-colors duration-150"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${t.kind === "sale" ? "bg-blue-950 text-blue-400 border border-blue-800/50" : "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40"}`}>
                    {t.kind === "sale" ? "Sale" : "Repair"}
                  </span>
                  <p className="text-[9px] text-slate-500 font-mono">{new Date(t.date).toLocaleDateString()}</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-300 shrink-0 ml-2">{formatCurrency(t.total)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-500 font-mono">Loading customer...</p>}>
      <CustomerDetailContent />
    </Suspense>
  );
}
