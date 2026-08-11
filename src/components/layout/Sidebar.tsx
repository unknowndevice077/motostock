"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { useSync } from "@/lib/sync/SyncProvider";
import { roleLabel } from "@/lib/format";
import { IconDashboard, IconBox, IconCart, IconWrench, IconTag, IconShield, IconLogout, IconChart, IconHistory } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, adminOnly: false },
  { href: "/inventory", label: "Inventory", icon: IconBox, adminOnly: false },
  { href: "/pos", label: "Point of Sale", icon: IconCart, adminOnly: false },
  { href: "/history", label: "Purchase History", icon: IconHistory, adminOnly: false },
  { href: "/repairs", label: "Repair Jobs", icon: IconWrench, adminOnly: false },
  { href: "/labels", label: "QR Labels", icon: IconTag, adminOnly: false },
  { href: "/reports", label: "Sales Reports", icon: IconChart, adminOnly: true },
  { href: "/admin", label: "Shop Settings", icon: IconShield, adminOnly: true },
] as const;

export function Sidebar({ lowStockCount }: { lowStockCount: number }) {
  const pathname = usePathname();
  const { shop, currentUser, logout } = useAuth();
  const { connected } = useSync();
  const isAdmin = currentUser?.role === "admin";
  const onAccount = pathname === "/account";

  return (
    <aside className="print:hidden w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800 select-none">
        {shop?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.logo} alt={shop.name} className="h-8 w-8 rounded-lg object-contain bg-slate-950 border border-slate-800 p-0.5 shrink-0" />
        ) : (
          <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shrink-0">M</div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-sm tracking-tight text-white truncate">MotoStock</p>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? "bg-emerald-400" : "bg-slate-600"}`}
              title={connected ? "Backed up to the cloud" : "Not backed up to the cloud yet"}
            />
            <p className="text-[9px] text-slate-500 font-mono truncate">{shop?.name ?? "Motor Shop"}</p>
          </div>
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

      <div className="border-t border-slate-800 p-3">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-lg">
          <Link
            href="/account"
            className={`flex-1 min-w-0 flex items-center gap-2.5 px-1.5 py-1.5 rounded-lg transition-colors duration-150 ${onAccount ? "bg-slate-800" : "hover:bg-slate-800/70"}`}
          >
            {currentUser?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUser.avatar} alt={currentUser.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-800 shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold text-white shrink-0 ring-2 ring-slate-800">
                {currentUser?.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate ${onAccount ? "text-white" : "text-slate-200"}`}>{currentUser?.name}</p>
              <span className="inline-block text-[8px] font-mono font-bold uppercase tracking-wider text-blue-400 bg-blue-950 border border-blue-800/50 rounded px-1.5 py-0.5 mt-0.5">
                {currentUser && roleLabel(currentUser.role)}
              </span>
            </div>
          </Link>
          <button
            onClick={logout}
            title="Log Out"
            className="shrink-0 p-2 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors duration-150"
          >
            <IconLogout width={15} height={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
