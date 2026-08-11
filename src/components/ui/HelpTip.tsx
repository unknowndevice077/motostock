"use client";

import React, { useEffect, useState } from "react";
import { IconHelp, IconX } from "./icons";

const KEY_PREFIX = "motostock_tip_dismissed_";

interface HelpTipProps {
  /** Unique per page/section — controls which tip is remembered as dismissed. */
  id: string;
  title?: string;
  children: React.ReactNode;
}

/**
 * A small dismissible "how this page works" banner. Dismissing it collapses
 * to a "Help" pill that reopens the same tip — so first-time guidance never
 * gets in the way twice, but it's never more than one click from coming back.
 */
export function HelpTip({ id, title = "How this page works", children }: HelpTipProps) {
  const [dismissed, setDismissed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(KEY_PREFIX + id) === "1");
    setHydrated(true);
  }, [id]);

  const dismiss = () => {
    localStorage.setItem(KEY_PREFIX + id, "1");
    setDismissed(true);
  };
  const reopen = () => {
    localStorage.removeItem(KEY_PREFIX + id);
    setDismissed(false);
  };

  if (!hydrated) return null;

  if (dismissed) {
    return (
      <button onClick={reopen} className="print:hidden inline-flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors" title="Show help for this page">
        <IconHelp width={13} height={13} /> Help
      </button>
    );
  }

  return (
    <div className="print:hidden bg-blue-950/30 border border-blue-900/40 rounded-xl px-4 py-3 flex items-start gap-3 animate-slideUp">
      <IconHelp width={16} height={16} className="text-blue-400 mt-0.5 shrink-0" />
      <div className="flex-1 text-xs text-slate-300 leading-relaxed">
        <p className="font-bold text-slate-200 mb-0.5">{title}</p>
        {children}
      </div>
      <button onClick={dismiss} className="text-slate-500 hover:text-slate-300 shrink-0" title="Dismiss">
        <IconX width={14} height={14} />
      </button>
    </div>
  );
}
