"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listMotorcycles, createMotorcycle, updateMotorcycle, deleteMotorcycle, type MotorcycleInput } from "@/lib/db/motorcycles";
import type { Motorcycle } from "@/types";
import { MOTORCYCLE_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { TextField, SelectField } from "@/components/ui/FormField";
import { IconPlus, IconEdit, IconTrash } from "@/components/ui/icons";

const emptyForm: MotorcycleInput = { modelName: "", vin: "", displacement: "", category: "Sport", price: 0, cost: 0, stock: 0 };

export function ShowroomTab() {
  const { shop, currentUser } = useAuth();
  const { push } = useToast();
  const isAdmin = currentUser?.role === "admin";

  const [bikes, setBikes] = useState<Motorcycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Motorcycle | null>(null);
  const [deleting, setDeleting] = useState<Motorcycle | null>(null);
  const [form, setForm] = useState<MotorcycleInput>(emptyForm);

  const reload = async () => {
    if (!shop) return;
    setBikes(await listMotorcycles(shop.id));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  const filtered = bikes.filter((b) => {
    const q = search.toLowerCase();
    return b.modelName.toLowerCase().includes(q) || b.vin.toLowerCase().includes(q);
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    await createMotorcycle(shop.id, form);
    setForm(emptyForm);
    setShowAdd(false);
    push("success", "Motorcycle added to showroom.");
    reload();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await updateMotorcycle(editing.id, form);
    setEditing(null);
    push("success", "Motorcycle updated.");
    reload();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    await deleteMotorcycle(deleting.id);
    push("info", `${deleting.modelName} removed from showroom.`);
    setDeleting(null);
    reload();
  };

  const columns: Column<Motorcycle>[] = [
    {
      header: "Motorcycle",
      render: (b) => (
        <>
          <p className="font-bold text-white">{b.modelName}</p>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-medium">{b.category}</span>
        </>
      ),
    },
    { header: "VIN", render: (b) => <span className="font-mono text-slate-400">{b.vin}</span> },
    { header: "Displacement", align: "center", render: (b) => <span className="font-mono text-slate-300">{b.displacement}</span> },
    { header: "Stock", align: "center", render: (b) => <span className="font-bold font-mono text-slate-200">{b.stock} units</span> },
    ...(isAdmin
      ? [{ header: "Retail Price", align: "right" as const, render: (b: Motorcycle) => <span className="font-mono text-slate-200 font-bold">{formatCurrency(b.price)}</span> }]
      : []),
    {
      header: "Actions",
      align: "center",
      render: (b) => (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => { setEditing(b); setForm({ modelName: b.modelName, vin: b.vin, displacement: b.displacement, category: b.category, price: b.price, cost: b.cost, stock: b.stock }); }} className="text-[10px] bg-blue-950 text-blue-400 hover:bg-blue-900 border border-blue-800/50 px-2 py-1 rounded font-mono transition-all duration-150 flex items-center gap-1">
            <IconEdit width={11} height={11} />
          </button>
          {isAdmin && (
            <button onClick={() => setDeleting(b)} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150 flex items-center gap-1">
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
        <input type="text" placeholder="Search by model or VIN..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-w-[240px] transition-all duration-200" />
        <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="self-end sm:self-auto">
          <IconPlus width={14} height={14} /> Add Motorcycle
        </Button>
      </div>

      {loading ? <TableSkeleton rows={5} cols={5} /> : <DataTable columns={columns} rows={filtered} keyExtractor={(b) => b.id} emptyMessage="No motorcycles match your search." />}

      {(showAdd || editing) && (
        <Modal title={editing ? "Edit Motorcycle" : "Add New Motorcycle"} onClose={() => { setShowAdd(false); setEditing(null); }}>
          <form onSubmit={editing ? handleUpdate : handleCreate} className="space-y-3">
            <TextField label="Model Name" required value={form.modelName} onChange={(v) => setForm({ ...form, modelName: v })} />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="VIN Code" required value={form.vin} onChange={(v) => setForm({ ...form, vin: v })} />
              <TextField label="Displacement (cc)" value={form.displacement} onChange={(v) => setForm({ ...form, displacement: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SelectField label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v as MotorcycleInput["category"] })} options={MOTORCYCLE_CATEGORIES} />
              <TextField label="Stock" type="number" value={form.stock} onChange={(v) => setForm({ ...form, stock: Number(v) || 0 })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Dealer Cost (₱)" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: Number(v) || 0 })} />
              <TextField label="Retail Price (₱)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: Number(v) || 0 })} />
            </div>
            <Button type="submit" className="w-full">{editing ? "Save Changes" : "Save Motorcycle"}</Button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove Motorcycle"
          message={`Remove "${deleting.modelName}" from the showroom? This can't be undone.`}
          confirmLabel="Remove"
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
