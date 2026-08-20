"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listRepairJobs, createRepairJob, type RepairJobInput } from "@/lib/db/repairJobs";
import type { RepairJob, RepairJobStatus, Customer } from "@/types";
import { formatCurrency } from "@/lib/format";
import { isWithinDateRange } from "@/lib/dateRange";
import { getCached, setCached } from "@/lib/db/cache";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { TextField, TextAreaField } from "@/components/ui/FormField";
import { HelpTip } from "@/components/ui/HelpTip";
import { DateRangeFilter } from "@/components/ui/DateRangeFilter";
import { CustomerPicker } from "@/components/ui/CustomerPicker";
import { IconPlus, IconWrench } from "@/components/ui/icons";

const emptyForm = { motorcycleDesc: "", laborFee: 0, notes: "" };

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

  const [jobs, setJobs] = useState<RepairJob[]>(() => (shop && getCached<RepairJob[]>(`repair_jobs:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`repair_jobs:${shop.id}`)));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!shop) return;
    listRepairJobs(shop.id).then((j) => {
      setCached(`repair_jobs:${shop.id}`, j);
      setJobs(j);
      setLoading(false);
    });
  }, [shop]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchesQuery =
        !q ||
        j.customerName.toLowerCase().includes(q) ||
        (j.motorcycleDesc ?? "").toLowerCase().includes(q) ||
        (j.customerPhone ?? "").toLowerCase().includes(q);
      return matchesQuery && isWithinDateRange(j.createdAt, dateFrom, dateTo);
    });
  }, [jobs, search, dateFrom, dateTo]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !customer) return;
    const input: RepairJobInput = {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone ?? "",
      motorcycleDesc: form.motorcycleDesc,
      laborFee: form.laborFee,
      notes: form.notes,
    };
    const job = await createRepairJob(shop.id, currentUser?.id ?? null, input);
    push("success", "Repair job created.");
    setForm(emptyForm);
    setCustomer(null);
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
    { header: "Date", render: (j) => <span className="font-mono text-slate-500 text-[11px]">{new Date(j.createdAt).toLocaleDateString()}</span> },
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
        parts consumed and labor, then mark it In Progress or Completed. Search by customer,
        motorcycle, or phone, or narrow to a date range. You can also add parts to an open job
        straight from <strong>POS &rarr; Repair Job</strong>.
      </HelpTip>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <IconWrench width={18} height={18} className="text-slate-300" /> Repair Jobs
          </h2>
          <p className="text-xs text-slate-400">Track jobs and the parts consumed against each one.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search customer, bike, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 min-w-[200px] transition-all duration-200"
          />
          <DateRangeFilter from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          <Button onClick={() => { setForm(emptyForm); setCustomer(null); setShowAdd(true); }}>
            <IconPlus width={14} height={14} /> New Job
          </Button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : (
        <DataTable columns={columns} rows={filteredJobs} keyExtractor={(j) => j.id} emptyMessage={jobs.length === 0 ? "No repair jobs yet." : "No jobs match your search or date range."} />
      )}

      {showAdd && (
        <Modal title="New Repair Job" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleCreate} className="space-y-3">
            {shop && <CustomerPicker shopId={shop.id} label="Customer Name" required value={customer} onChange={setCustomer} />}
            <TextField label="Labor Fee (₱)" type="number" step="0.01" value={form.laborFee} onChange={(v) => setForm({ ...form, laborFee: Number(v) || 0 })} />
            <TextField label="Motorcycle (model / plate)" value={form.motorcycleDesc} onChange={(v) => setForm({ ...form, motorcycleDesc: v })} />
            <TextAreaField label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="What's being worked on..." />
            <Button type="submit" className="w-full" disabled={!customer}>Create Job</Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
