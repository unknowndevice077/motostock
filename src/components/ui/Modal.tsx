"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  accent?: "default" | "danger";
  maxWidth?: string;
}

export function Modal({ title, onClose, children, accent = "default", maxWidth = "max-w-md" }: ModalProps) {
  // Rendered through a portal straight onto <body> — never nested inside a
  // page container. Every page wrapper animates in with a transform
  // (.animate-slideUp), and CSS makes any ancestor with an active transform
  // the positioning context for `position: fixed` descendants — so without
  // the portal this dialog would be "fixed" to that page div instead of the
  // window, and get clipped by its scroll container. Portaling sidesteps the
  // whole class of bug instead of fighting it per-page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-start justify-center p-4 overflow-y-auto animate-fadeIn" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-slate-900 border ${accent === "danger" ? "border-red-900/40" : "border-slate-800"} p-6 rounded-xl w-full ${maxWidth} shadow-2xl space-y-4 animate-scaleUp my-8 max-h-[85vh] overflow-y-auto`}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className={`text-sm font-bold uppercase tracking-wider font-mono ${accent === "danger" ? "text-red-400" : "text-slate-200"}`}>{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xs transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
