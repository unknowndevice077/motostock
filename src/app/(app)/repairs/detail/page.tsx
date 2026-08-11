"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { getRepairJob, addPartToJob, setJobStatus, updateJobDetails } from "@/lib/db/repairJobs";
import { listParts } from "@/lib/db/parts";
import type { Part, RepairJob, RepairJobStatus } from "@/types";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconPrinter, IconPlus } from "@/components/ui/icons";

const STATUS_FLOW: RepairJobStatus[] = ["open", "in_progress", "completed"];
const statusLabel: Record<RepairJobStatus, string> = { open: "Open", in_progress: "In Progress", completed: "Completed" };

function RepairDetailContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { shop, currentUser, track } = useAuth();
  const { push } = useToast();

  const [job, setJob] = useState<RepairJob | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [partQuery, setPartQuery] = useState("");
  const [laborFeeInput, setLaborFeeInput] = useState("0");

  const reload = async () => {
    if (!jobId) return;
    const j = await getRepairJob(jobId);
    setJob(j);
    if (j) setLaborFeeInput(String(j.laborFee));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    if (!shop) return;
    listParts(shop.id).then(setParts);
  }, [shop]);

  const matches = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return [];
    return parts.filter((p) => p.partName.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)).slice(0, 6);
  }, [parts, partQuery]);

  if (!job) return <p className="text-xs text-slate-500 font-mono">Loading job...</p>;

  const handleAddPart = async (part: Part) => {
    if (part.stock <= 0) {
      push("error", `${part.partName} is out of stock.`);
      return;
    }
    await addPartToJob(job.id, part.id, part.partName, part.partNumber, 1, part.sellingPrice);
    setPartQuery("");
    push("success", `${part.partName} added to job.`);
    reload();
  };

  const handleStatusChange = async (status: RepairJobStatus) => {
    await setJobStatus(job.id, status);
    if (status === "completed") track("repair_job_completed", { total: job.total, partsCount: job.parts.length });
    push("success", `Job marked ${statusLabel[status].toLowerCase()}.`);
    reload();
  };

  const handleLaborFeeSave = async () => {
    await updateJobDetails(job.id, { laborFee: Number(laborFeeInput) || 0 });
    push("success", "Labor fee updated.");
    reload();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <HelpTip id="repairs-detail">
        Search parts to log what was consumed on this job — stock updates automatically. Save a
        labor fee, move the status through Open &rarr; In Progress &rarr; Completed, then print the
        invoice.
      </HelpTip>

      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{job.customerName}&apos;s Repair Job</h2>
          <p className="text-xs text-slate-400 font-mono">{job.motorcycleDesc || "No motorcycle details"} {job.customerPhone && `· ${job.customerPhone}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <IconPrinter width={14} height={14} /> Print Invoice
          </Button>
        </div>
      </div>

      <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Parts Consumed</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Search parts to add..."
                value={partQuery}
                onChange={(e) => setPartQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
              {matches.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg shadow-2xl overflow-hidden">
                  {matches.map((p) => (
                    <button key={p.id} onClick={() => handleAddPart(p)} className="w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-200 truncate">{p.partName}</span>
                      <span className="text-slate-400 font-mono shrink-0">{formatCurrency(p.sellingPrice)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-800/60">
              {job.parts.length === 0 && <p className="text-center text-[11px] text-slate-600 font-mono py-6">No parts logged against this job yet.</p>}
              {job.parts.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <p className="text-slate-200 font-bold">{p.partName}</p>
                    <p className="text-[10px] font-mono text-slate-500">{p.partNumber} × {p.qty}</p>
                  </div>
                  <span className="font-mono text-slate-300">{formatCurrency(p.qty * p.unitPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Status</h3>
            <div className="flex flex-col gap-2">
              {STATUS_FLOW.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`text-xs font-mono font-bold px-3 py-2 rounded-lg text-left transition-all duration-150 ${
                    job.status === s ? "bg-blue-500 text-slate-950" : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-blue-700"
                  }`}
                >
                  {statusLabel[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Labor & Total</h3>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="Labor Fee (₱)" type="number" step="0.01" value={laborFeeInput} onChange={setLaborFeeInput} />
              </div>
              <Button variant="secondary" onClick={handleLaborFeeSave}>Save</Button>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[11px] uppercase font-mono text-slate-400">Job Total</span>
              <span className="text-xl font-black text-white">{formatCurrency(job.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Printable invoice — hidden on screen, shown only when printing */}
      <div className="hidden print:block bg-white text-slate-900 rounded-lg p-6 font-mono text-xs max-w-sm mx-auto">
        <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
          <p className="font-black text-sm uppercase tracking-wide">{shop?.name ?? "MotoStock"}</p>
          <p className="text-[10px] text-slate-500">Repair Job Invoice</p>
        </div>
        <div className="py-3 border-b border-dashed border-slate-300 space-y-0.5 text-[10px] text-slate-600">
          <div className="flex justify-between"><span>Job #</span><span>{job.id.slice(0, 8).toUpperCase()}</span></div>
          <div className="flex justify-between"><span>Customer</span><span>{job.customerName}</span></div>
          <div className="flex justify-between"><span>Motorcycle</span><span>{job.motorcycleDesc || "—"}</span></div>
          <div className="flex justify-between"><span>Mechanic</span><span>{currentUser?.name ?? "—"}</span></div>
          <div className="flex justify-between"><span>Status</span><span>{statusLabel[job.status]}</span></div>
        </div>
        <table className="w-full py-3 border-b border-dashed border-slate-300">
          <tbody>
            {job.parts.map((p) => (
              <tr key={p.id}>
                <td className="py-1 align-top">
                  <p>{p.partName}</p>
                  <p className="text-[9px] text-slate-500">{p.partNumber} × {p.qty}</p>
                </td>
                <td className="py-1 text-right align-top">{formatCurrency(p.qty * p.unitPrice)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-1">Labor</td>
              <td className="py-1 text-right">{formatCurrency(job.laborFee)}</td>
            </tr>
          </tbody>
        </table>
        <div className="pt-3 flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatCurrency(job.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default function RepairDetailPage() {
  return (
    <Suspense fallback={<p className="text-xs text-slate-500 font-mono">Loading job...</p>}>
      <RepairDetailContent />
    </Suspense>
  );
}
