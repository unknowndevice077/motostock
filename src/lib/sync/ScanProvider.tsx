"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useSync } from "@/lib/sync/SyncProvider";
import { useToast } from "@/components/ui/Toast";
import { subscribeScanEvents, type ScanEvent } from "@/lib/sync/scanChannel";

const MAX_RECENT = 20;

type ScanListener = (event: ScanEvent) => void;

interface ScanContextValue {
  recentScans: ScanEvent[];
  /** Register to hear every scan live (e.g. POS adding it straight to an
   * open cart). Returns an unsubscribe function. */
  onScan: (listener: ScanListener) => () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

/**
 * Subscribes once per shop to the phone-scanner Realtime feed (see
 * lib/sync/scanChannel.ts) and fans each scan out two ways: a toast from any
 * screen (the "live lookup" half of the feature) and to any page-level
 * listener registered via onScan (POS uses this to drop a scan straight into
 * an open cart). Mounted inside SyncProvider in the app shell.
 */
export function ScanProvider({ children }: { children: React.ReactNode }) {
  const { shop } = useAuth();
  const { connected } = useSync();
  const { push } = useToast();
  const [recentScans, setRecentScans] = useState<ScanEvent[]>([]);
  const listeners = useRef<Set<ScanListener>>(new Set());

  useEffect(() => {
    if (!shop || !connected) return;
    const unsubscribe = subscribeScanEvents(shop.id, (event) => {
      setRecentScans((prev) => [event, ...prev].slice(0, MAX_RECENT));
      push("info", `Scanned: ${event.partName} — ${event.stock} left`);
      listeners.current.forEach((listener) => listener(event));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, connected]);

  const onScan = useCallback((listener: ScanListener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return <ScanContext.Provider value={{ recentScans, onScan }}>{children}</ScanContext.Provider>;
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within a ScanProvider");
  return ctx;
}
