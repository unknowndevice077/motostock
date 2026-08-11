"use client";

import React, { useState } from "react";
import { PartsTab } from "./PartsTab";
import { ShowroomTab } from "./ShowroomTab";
import { HelpTip } from "@/components/ui/HelpTip";

export default function InventoryPage() {
  const [tab, setTab] = useState<"parts" | "showroom">("parts");

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="inventory">
        <strong>Parts</strong> tracks spare parts stock — use <strong>+ Stock</strong> to log an
        incoming shipment (it updates cost automatically). <strong>Showroom</strong> tracks whole
        motorcycles for sale. Items at or below their minimum threshold are flagged in amber.
      </HelpTip>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">Inventory</h2>
          <p className="text-xs text-slate-400">Spare parts stock and whole-motorcycle showroom, in one place.</p>
        </div>
        <div className="flex items-center bg-slate-950/60 p-1 rounded-lg border border-slate-800">
          <button onClick={() => setTab("parts")} className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${tab === "parts" ? "bg-slate-800 text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"}`}>
            Parts
          </button>
          <button onClick={() => setTab("showroom")} className={`px-4 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider font-mono transition-all duration-200 ${tab === "showroom" ? "bg-slate-800 text-white border-b-2 border-blue-500" : "text-slate-400 hover:text-slate-200"}`}>
            Showroom
          </button>
        </div>
      </div>

      {tab === "parts" ? <PartsTab /> : <ShowroomTab />}
    </div>
  );
}
