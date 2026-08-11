"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listParts, createPart, updatePart, deletePart, receiveStock, type PartInput } from "@/lib/db/parts";
import type { Part } from "@/types";
import { PART_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { TextField, SelectField } from "@/components/ui/FormField";
import { IconPlus, IconEdit, IconTrash } from "@/components/ui/icons";

const emptyPartForm: PartInput = { partName: "", partNumber: "", category: "Engine", stock: 0, minThreshold: 0, costPrice: 0, sellingPrice: 0 };

export function PartsTab() {
  const { shop, currentUser } = useAuth();
  const { push } = useToast();
  const isAdmin = currentUser?.role === "admin";

  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [deleting, setDeleting] = useState<Part | null>(null);
  const [receiving, setReceiving] = useState<Part | null>(null);

  const [form, setForm] = useState<PartInput>(emptyPartForm);
  const [receiveQty, setReceiveQty] = useState("");
  const [receiveCost, setReceiveCost] = useState("");
  const [receiveSupplier, setReceiveSupplier] = useState("");

  const reload = async () => {
    if (!shop) return;
    setParts(await listParts(shop.id));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  const filtered = parts.filter((p) => {
    const q = search.toLowerCase();
    return p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q);
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    await createPart(shop.id, form);
    setForm(emptyPartForm);
    setShowAdd(false);
    push("success", "Part added to inventory.");
    reload();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updatePart(editing.id, form);
    setEditing(null);
    push("success", "Part updated.");
    reload();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deletePart(deleting.id);
    push("info", `${deleting.partName} removed from inventory.`);
    setDeleting(null);
    reload();
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiving || !shop) return;
    const qty = Number(receiveQty) || 0;
    if (qty <= 0) return;
    await receiveStock(shop.id, {
      partId: receiving.id,
      userId: currentUser?.id ?? null,
      qty,
      unitCost: Number(receiveCost) || receiving.costPrice,
      supplier: receiveSupplier,
      reference: "",
    });
    push("success", `Received ${qty} × ${receiving.partName}.`);
    setReceiving(null);
    setReceiveQty("");
    setReceiveCost("");
    setReceiveSupplier("");
    reload();
  };

  const columns: Column<Part>[] = [
    {
      header: "Component",
      render: (p) => (
        <>
          <p className="font-bold text-white">{p.partName}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-mono font-medium">{p.category}</span>
        </>
      ),
    },
    { header: "Part Number", render: (p) => <span className="font-mono text-slate-400">{p.partNumber}</span> },
    {
      header: "Stock",
      align: "center",
      render: (p) => (
        <span className={`font-mono font-bold px-2 py-0.5 rounded ${p.stock <= p.minThreshold ? "text-amber-400 bg-amber-950/40 border border-amber-900/40 animate-pulse" : "text-slate-300 bg-slate-950"}`}>
          {p.stock} units
        </span>
      ),
    },
    ...(isAdmin
      ? [{ header: "Retail Price", align: "right" as const, render: (p: Part) => <span className="font-mono font-bold text-slate-200">{formatCurrency(p.sellingPrice)}</span> }]
      : []),
    {
      header: "Actions",
      align: "center",
      render: (p) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setReceiving(p)} className="text-[10px] bg-blue-950 text-blue-400 hover:bg-blue-900 border border-blue-800/50 px-2 py-1 rounded font-mono transition-all duration-150">
            + Stock
          </button>
          <button onClick={() => { setEditing(p); setForm({ partName: p.partName, partNumber: p.partNumber, category: p.category, stock: p.stock, minThreshold: p.minThreshold, costPrice: p.costPrice, sellingPrice: p.sellingPrice }); }} className="text-[10px] bg-blue-950 text-blue-400 hover:bg-blue-900 border border-blue-800/50 px-2 py-1 rounded font-mono transition-all duration-150 flex items-center gap-1">
            <IconEdit width={11} height={11} />
          </button>
          {isAdmin && (
            <button onClick={() => setDeleting(p)} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150 flex items-center gap-1">
              <IconTrash width={11} height={11} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <input type="text" placeholder="Search parts by name or number..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-w-[240px] transition-all duration-200" />
        <Button onClick={() => { setForm(emptyPartForm); setShowAdd(true); }} className="self-end sm:self-auto">
          <IconPlus width={14} height={14} /> Add Part
        </Button>
      </div>

      {loading ? <TableSkeleton rows={5} cols={4} /> : <DataTable columns={columns} rows={filtered} keyExtractor={(p) => p.id} emptyMessage="No parts match your search." />}

      {(showAdd || editing) && (
        <Modal title={editing ? "Edit Part" : "Add New Part"} onClose={() => { setShowAdd(false); setEditing(null); }}>
          <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-3">
            <TextField label="Part Name" required value={form.partName} onChange={(v) => setForm({ ...form, partName: v })} />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Part Number" required value={form.partNumber} onChange={(v) => setForm({ ...form, partNumber: v })} />
              <SelectField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v as PartInput["category"] })} options={PART_CATEGORIES} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Stock Qty" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: Number(v) || 0 })} />
              <TextField label="Min Threshold" type="number" value={form.minThreshold} onChange={(v) => setForm({ ...form, minThreshold: Number(v) || 0 })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Cost Price (₱)" type="number" step="0.01" value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: Number(v) || 0 })} />
              <TextField label="Selling Price (₱)" type="number" step="0.01" value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: Number(v) || 0 })} />
            </div>
            <Button type="submit" className="w-full">{editing ? "Save Changes" : "Save Part"}</Button>
          </form>
        </Modal>
      )}

      {receiving && (
        <Modal title={`Receive Stock — ${receiving.partName}`} onClose={() => setReceiving(null)}>
          <form onSubmit={handleReceive} className="space-y-3">
            <p className="text-[11px] text-slate-500">Log an ingoing shipment from a supplier. This increases stock and updates the cost price.</p>
            <TextField label="Quantity Received" type="number" required value={receiveQty} onChange={setReceiveQty} />
            <TextField label="Unit Cost (₱)" type="number" step="0.01" value={receiveCost} onChange={setReceiveCost} placeholder={receiving.costPrice.toFixed(2)} />
            <TextField label="Supplier (optional)" value={receiveSupplier} onChange={setReceiveSupplier} />
            <Button type="submit" variant="primary" className="w-full">Record Receipt</Button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove Part"
          message={`Remove "${deleting.partName}" from your inventory? This can't be undone.`}
          confirmLabel="Remove"
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
