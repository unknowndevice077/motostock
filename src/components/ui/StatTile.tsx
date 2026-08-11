"use client";

import React, { useEffect, useState } from "react";

interface StatTileProps {
  label: string;
  value: number;
  format?: "currency" | "number";
  suffix?: string;
  accent?: "primary" | "blue" | "amber";
}

const accentClasses: Record<NonNullable<StatTileProps["accent"]>, string> = {
  primary: "text-slate-100",
  blue: "text-blue-400",
  amber: "text-amber-400",
};

/** Animates the displayed number counting up to `value` on mount/change. */
function useCountUp(target: number, durationMs = 500) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return display;
}

export function StatTile({ label, value, format = "number", suffix = "", accent = "primary" }: StatTileProps) {
  const animated = useCountUp(value);
  const text =
    format === "currency"
      ? `₱${animated.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : Math.round(animated).toLocaleString();

  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">{label}</p>
      <p className={`text-2xl font-black mt-1 ${accentClasses[accent]}`}>
        {text}
        {suffix}
      </p>
    </div>
  );
}
