"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listRepairJobs, createRepairJob, type RepairJobInput } from "@/lib/db/repairJobs";
import type { RepairJob, RepairJobStatus } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconPlus, IconWrench } from "@/components/ui/icons";

const emptyForm: RepairJobInput = { customerName: "", customerPhone: "", motorcycleDesc: "", laborFee: 0, notes: "" };

const statusClasses: Record<RepairJobStatus, string> = {
  open: "bg-slate-950 text-slate-300 border border-slate-700",
  in_progress: "bg-blue-950 text-blue-400 border border-blue-800/50",
  completed: "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40",
};

const statusLabel: Record<RepairJobStatus, string> = { open: "Open", in_progress: "In Progress", completed: "Completed" };

export default function RepairsPage() {
  const { shop, currentUser } = useAuth();
  const { push } = useToast();
  const router = useRouter();

  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RepairJobInput>(emptyForm);

  useEffect(() => {
    if (!shop) return;
    listRepairJobs(shop.id).then((j) => {
      setJobs(j);
      setLoading(false);
    });
  }, [shop]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    const job = await createRepairJob(shop.id, currentUser?.id ?? null, form);
    push("success", "Repair job created.");
    setForm(emptyForm);
    setShowAdd(false);
    router.push(`/repairs/detail?jobId=${job.id}`);
  };

  const columns: Column<RepairJob>[] = [
    {
      header: "Customer",
      render: (j) => (
        <>
          <p className="font-bold text-white">{j.customerName}</p>
          {j.customerPhone && <p className="text-[10px] font-mono text-slate-500">{j.customerPhone}</p>}
        </>
      ),
    },
    { header: "Motorcycle", render: (j) => <span className="font-mono text-slate-400">{j.motorcycleDesc || "—"}</span> },
    { header: "Status", align: "center", render: (j) => <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${statusClasses[j.status]}`}>{statusLabel[j.status]}</span> },
    { header: "Total", align: "right", render: (j) => <span className="font-mono font-bold text-slate-200">{formatCurrency(j.total)}</span> },
    {
      header: "",
      align: "right",
      render: (j) => (
        <Link href={`/repairs/detail?jobId=${j.id}`} className="text-[10px] bg-blue-950 text-blue-400 hover:bg-blue-900 border border-blue-800/50 px-3 py-1.5 rounded font-mono transition-all duration-150">
          Open
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="repairs-list">
        Create a job for each customer/motorcycle that comes in. Open its detail page to log
        parts consumed and labor, then mark it In Progress or Completed. You can also add parts
        to an open job straight from <strong>POS &rarr; Repair Job</strong>.
      </HelpTip>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <IconWrench width={18} height={18} className="text-slate-300" /> Repair Jobs
          </h2>
          <p className="text-xs text-slate-400">Track jobs and the parts consumed against each one.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShowAdd(true); }}>
          <IconPlus width={14} height={14} /> New Job
        </Button>
      </div>

      {loading ? <TableSkeleton rows={4} cols={5} /> : <DataTable columns={columns} rows={jobs} keyExtractor={(j) => j.id} emptyMessage="No repair jobs yet." />}

      {showAdd && (
        <Modal title="New Repair Job" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            <TextField label="Customer Name" required value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Phone (optional)" value={form.customerPhone} onChange={(v) => setForm({ ...form, customerPhone: v })} />
              <TextField label="Labor Fee (₱)" type="number" step="0.01" value={form.laborFee} onChange={(v) => setForm({ ...form, laborFee: Number(v) || 0 })} />
            </div>
            <TextField label="Motorcycle (model / plate)" value={form.motorcycleDesc} onChange={(v) => setForm({ ...form, motorcycleDesc: v })} />
            <TextAreaField label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="What's being worked on..." />
            <Button type="submit" className="w-full">Create Job</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
