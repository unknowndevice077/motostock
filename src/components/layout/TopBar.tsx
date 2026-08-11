"use client";

import React from "react";
import { useAuth } from "@/lib/auth/session";
import { useSync } from "@/lib/sync/SyncProvider";
import { roleLabel } from "@/lib/format";
import { IconLogout } from "@/components/ui/icons";

const statusDot: Record<string, string> = {
  idle: "bg-slate-600",
  syncing: "bg-blue-400 animate-pulse",
  synced: "bg-emerald-400",
  offline: "bg-slate-600",
  "not-connected": "bg-slate-600",
  error: "bg-red-400",
};

function statusLabel(status: string, pendingCount: number, connected: boolean): string {
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Sync error — will retry";
  // Not yet linked to the cloud at all (first run offline, etc). Everything
  // still works — it's just waiting for its first connection.
  if (!connected) return pendingCount > 0 ? `Saved here — ${pendingCount} waiting to sync` : "Saved on this device";
  if (status === "offline") return pendingCount > 0 ? `Offline — ${pendingCount} saved, will sync` : "Offline — saved here";
  if (pendingCount > 0) return `Syncing ${pendingCount} change${pendingCount === 1 ? "" : "s"}…`;
  return "Backed up to the cloud";
}

export function TopBar() {
  const { currentUser, logout } = useAuth();
  const { status, pendingCount, connected, syncNow } = useSync();

  return (
    <header className="print:hidden h-16 shrink-0 bg-slate-900/80 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      <button onClick={syncNow} className="flex items-center gap-2 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors" title="Sync now">
        <span className={`h-1.5 w-1.5 rounded-full ${statusDot[status] ?? "bg-slate-600"}`} />
        {statusLabel(status, pendingCount, connected)}
      </button>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-bold text-slate-200">{currentUser?.name}</p>
          <p className="text-[9px] text-blue-400 font-mono uppercase tracking-widest">{currentUser && roleLabel(currentUser.role)}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-950/40 border border-slate-700 hover:border-red-900 text-slate-400 hover:text-red-400 transition-all duration-200 text-xs px-3 py-1.5 rounded-lg"
        >
          <IconLogout width={14} height={14} />
          Lock Session
        </button>
      </div>
    </header>
  );
}
