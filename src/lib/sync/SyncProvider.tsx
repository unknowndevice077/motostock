"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { runSync, countPendingChanges } from "./engine";
import { isCloudConnected } from "./cloudAuth";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "not-connected" | "error";

interface SyncContextValue {
  status: SyncStatus;
  lastSyncedAt: Date | null;
  pendingCount: number;
  connected: boolean;
  syncNow: () => void;
  refreshConnection: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const SYNC_INTERVAL_MS = 60_000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { shop } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const inFlight = useRef(false);

  const refreshPending = useCallback(async () => {
    if (!shop) return;
    try {
      setPendingCount(await countPendingChanges(shop.id));
    } catch (err) {
      console.error("Failed to count pending sync changes:", err);
    }
  }, [shop]);

  const refreshConnection = useCallback(async () => {
    try {
      setConnected(await isCloudConnected());
    } catch (err) {
      console.error("Failed to check cloud connection:", err);
      setConnected(false);
    }
  }, []);

  const syncNow = useCallback(() => {
    if (!shop || inFlight.current) return;
    inFlight.current = true;
    setStatus("syncing");
    runSync(shop.id)
      .then(async (outcome) => {
        if (outcome.ran === true) {
          setStatus("synced");
          setLastSyncedAt(new Date());
          setConnected(true);
        } else if (outcome.ran === false && outcome.reason === "offline") {
          setStatus("offline");
        } else if (outcome.ran === false && (outcome.reason === "not-connected" || outcome.reason === "not-configured")) {
          setStatus("not-connected");
          setConnected(false);
        } else {
          setStatus("error");
        }
        await refreshPending();
      })
      .catch((err) => {
        console.error("Sync cycle failed unexpectedly:", err);
        setStatus("error");
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [shop, refreshPending]);

  useEffect(() => {
    refreshConnection();
    refreshPending();
  }, [refreshConnection, refreshPending]);

  useEffect(() => {
    if (!shop) return;
    syncNow();
    const interval = setInterval(syncNow, SYNC_INTERVAL_MS);
    const onOnline = () => syncNow();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  const value: SyncContextValue = { status, lastSyncedAt, pendingCount, connected, syncNow, refreshConnection };
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
