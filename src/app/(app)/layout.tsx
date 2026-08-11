"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { listParts } from "@/lib/db/parts";
import { SyncProvider } from "@/lib/sync/SyncProvider";

const STALL_TIMEOUT_MS = 8000;

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, currentUser, shop, track } = useAuth();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [stalled, setStalled] = useState(false);
  const openedTracked = useRef(false);

  useEffect(() => {
    if (!loading && !currentUser) router.replace("/login");
  }, [loading, currentUser, router]);

  useEffect(() => {
    if (!(loading || !currentUser)) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading, currentUser]);

  useEffect(() => {
    if (currentUser && !openedTracked.current) {
      openedTracked.current = true;
      track("app_opened", { role: currentUser.role });
    }
  }, [currentUser, track]);

  useEffect(() => {
    if (!shop) return;
    let cancelled = false;
    listParts(shop.id)
      .then((parts) => {
        if (cancelled) return;
        setLowStockCount(parts.filter((p) => p.stock <= p.minThreshold).length);
      })
      .catch((err) => console.error("Failed to load low-stock count:", err));
    return () => {
      cancelled = true;
    };
  }, [shop, currentUser]);

  if (loading || !currentUser) {
    if (stalled) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-3">
            <p className="text-sm font-semibold text-amber-400">Taking longer than expected</p>
            <p className="text-xs text-slate-400">The local database didn't respond in time. This usually clears up on a reload.</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 font-mono text-xs">
          <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
          Opening console...
        </div>
      </div>
    );
  }

  return (
    <SyncProvider>
      <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased font-sans print:bg-white print:block">
        <Sidebar lowStockCount={lowStockCount} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />
          <main className="flex-1 p-6 overflow-y-auto space-y-6 animate-fadeIn print:p-0">{children}</main>
        </div>
      </div>
    </SyncProvider>
  );
}
