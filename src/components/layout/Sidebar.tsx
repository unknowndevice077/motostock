"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { IconDashboard, IconBox, IconCart, IconWrench, IconTag, IconShield } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, adminOnly: false },
  { href: "/inventory", label: "Inventory", icon: IconBox, adminOnly: false },
  { href: "/pos", label: "Point of Sale", icon: IconCart, adminOnly: false },
  { href: "/repairs", label: "Repair Jobs", icon: IconWrench, adminOnly: false },
  { href: "/labels", label: "QR Labels", icon: IconTag, adminOnly: false },
  { href: "/admin", label: "Shop Settings", icon: IconShield, adminOnly: true },
] as const;

export function Sidebar({ lowStockCount }: { lowStockCount: number }) {
  const pathname = usePathname();
  const { shop, currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  return (
    <aside className="print:hidden w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800 select-none">
        <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm">M</div>
        <div className="min-w-0">
          <p className="font-bold text-sm tracking-tight text-white truncate">MotoStock</p>
          <p className="text-[9px] text-slate-500 font-mono truncate">{shop?.name ?? "Motor Shop"}</p>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-400" />}
              <Icon className={active ? "text-blue-400" : "text-slate-500"} />
              {item.label}
              {item.href === "/inventory" && lowStockCount > 0 && (
                <span className="ml-auto text-[9px] font-mono font-bold bg-amber-950/60 text-amber-400 border border-amber-900/50 rounded-full px-1.5 py-0.5 animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
