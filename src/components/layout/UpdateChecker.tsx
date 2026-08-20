"use client";

import React, { useEffect, useState } from "react";
import { checkForUpdate, restartToApplyUpdate } from "@/lib/updater";
import { IconDownload } from "@/components/ui/icons";

const CHECK_DELAY_MS = 5000; // never compete with app startup for attention

/**
 * Silent background update check — never blocks or interrupts. If a signed
 * update is found it's downloaded automatically, then this shows a small
 * persistent banner (deliberately not a fire-and-forget Toast — staff mid-
 * sale shouldn't be forced into a restart, so it waits for a click and
 * doesn't auto-dismiss). Renders nothing while running outside a Tauri
 * window (e.g. `next dev` in a browser) since the plugin has nothing to
 * check against there.
 */
export function UpdateChecker() {
  const [ready, setReady] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate().then((update) => {
        if (update) setReady(true);
      });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <div className="print:hidden fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slideUp">
      <div className="flex items-center gap-3 bg-blue-950/95 border border-blue-800 rounded-xl px-4 py-2.5 shadow-2xl">
        <IconDownload width={15} height={15} className="text-blue-400 shrink-0" />
        <p className="text-xs text-blue-200">
          <span className="font-bold">Update ready.</span> Restart to finish installing — your data stays exactly as it is.
        </p>
        <button
          onClick={() => {
            setRestarting(true);
            restartToApplyUpdate();
          }}
          disabled={restarting}
          className="shrink-0 text-[11px] font-mono font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-colors duration-150"
        >
          {restarting ? "Restarting..." : "Restart Now"}
        </button>
      </div>
    </div>
  );
}
