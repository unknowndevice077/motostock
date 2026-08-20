"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { getSaleById } from "@/lib/db/sales";
import type { Sale } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { IconPrinter } from "@/components/ui/icons";

function ReceiptContent() {
  const searchParams = useSearchParams();
  const saleId = searchParams.get("saleId");
  const { shop, currentUser } = useAuth();
  const [sale, setSale] = useState<Sale | null>(null);

  useEffect(() => {
    if (!saleId) return;
    getSaleById(saleId).then(setSale);
  }, [saleId]);

  if (!sale) {
    return <p className="text-xs text-slate-500 font-mono">Loading receipt...</p>;
  }

  const createdAt = new Date(sale.createdAt);

  return (
    <div className="max-w-sm mx-auto space-y-4 animate-fadeIn">
      {/* Printing here goes through the OS print dialog like any other app —
          there's no direct printer driver code, so it works with whatever
          printer Windows already has installed, including thermal receipt
          printers (they install as a normal Windows printer). This just
          makes sure the page itself is sized for an 80mm roll instead of
          defaulting to a full A4/Letter sheet when that dialog opens. */}
      <style>{"@media print { @page { size: 80mm auto; margin: 4mm; } }"}</style>
      <div className="print:hidden flex items-center gap-2">
        <Button onClick={() => window.print()}>
          <IconPrinter width={14} height={14} /> Print Receipt
        </Button>
        <Link href="/pos">
          <Button variant="secondary">New Sale</Button>
        </Link>
        {sale.customerId && (
          <Link href={`/customers/detail?customerId=${sale.customerId}`} className="text-[11px] font-mono text-blue-400 hover:text-blue-300 ml-1">
            View customer history →
          </Link>
        )}
      </div>

      <div className="bg-white text-slate-900 rounded-lg p-6 font-mono text-xs shadow-2xl print:shadow-none print:rounded-none">
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          {shop?.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo} alt={shop.name} className="h-10 mx-auto object-contain mb-1" />
          )}
          <p className="font-black text-sm uppercase tracking-wide">{shop?.name ?? "MotoStock"}</p>
          <p className="text-[10px] text-slate-500">Parts &amp; Repairs Receipt</p>
        </div>

        <div className="py-3 border-b border-dashed border-slate-300 space-y-0.5 text-[10px] text-slate-600">
          <div className="flex justify-between"><span>Receipt #</span><span>{sale.id.slice(0, 8).toUpperCase()}</span></div>
          <div className="flex justify-between"><span>Date</span><span>{createdAt.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Cashier</span><span>{currentUser?.name ?? "—"}</span></div>
          {sale.customerName && <div className="flex justify-between"><span>Customer</span><span>{sale.customerName}</span></div>}
        </div>

        <table className="w-full py-3 border-b border-dashed border-slate-300">
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id}>
                <td className="py-1 align-top">
                  <p>{item.partName}</p>
                  {item.partId && <p className="text-[9px] text-slate-500">{item.partNumber} × {item.qty}</p>}
                </td>
                <td className="py-1 text-right align-top">{formatCurrency(item.qty * item.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pt-3 flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatCurrency(sale.total)}</span>
        </div>

        <p className="text-center text-[10px] text-slate-500 pt-4">Thank you for your business!</p>
      </div>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-500 font-mono">Loading receipt...</p>}>
      <ReceiptContent />
    </Suspense>
  );
}
