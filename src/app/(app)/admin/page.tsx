"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listUsers, createUser, deleteUser } from "@/lib/db/users";
import { renameShop } from "@/lib/db/shops";
import { provisionShopInCloud } from "@/lib/sync/cloudAuth";
import { useSync } from "@/lib/sync/SyncProvider";
import type { AppUser, Role } from "@/types";
import { roleLabel } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TextField, SelectField } from "@/components/ui/FormField";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconPlus, IconTrash } from "@/components/ui/icons";

export default function AdminPage() {
  const { shop, currentUser, refreshShop } = useAuth();
  const { connected, syncNow, refreshConnection } = useSync();
  const { push } = useToast();

  const [showConnect, setShowConnect] = useState(false);
  const [connectPassword, setConnectPassword] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [shopName, setShopName] = useState(shop?.name ?? "");

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as Role });

  const reload = async () => {
    if (!shop) return;
    setUsers(await listUsers(shop.id));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    setShopName(shop?.name ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]);

  if (currentUser?.role !== "admin") {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <p className="text-sm font-bold text-slate-300">Shop owners only</p>
        <p className="text-xs text-slate-500 mt-1">Your account doesn&apos;t have access to shop settings.</p>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    await createUser(shop.id, form.name, form.email, form.password, form.role);
    setForm({ name: "", email: "", password: "", role: "user" });
    setShowAdd(false);
    push("success", `${form.name} added as ${roleLabel(form.role)}.`);
    reload();
  };

  const handleDeleteUser = async () => {
    if (!deleting) return;
    if (deleting.id === currentUser.id) {
      push("error", "You can't remove your own account.");
      setDeleting(null);
      return;
    }
    await deleteUser(deleting.id);
    push("info", `${deleting.name} removed.`);
    setDeleting(null);
    reload();
  };

  const handleRenameShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !shopName.trim()) return;
    await renameShop(shop.id, shopName.trim());
    await refreshShop();
    push("success", "Shop name updated.");
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !currentUser) return;
    setConnecting(true);
    try {
      const result = await provisionShopInCloud({
        shopId: shop.id,
        shopName: shop.name,
        adminId: currentUser.id,
        adminName: currentUser.name,
        email: currentUser.email,
        password: connectPassword,
      });
      if (result.ok === false) {
        push("error", result.error);
      } else {
        push("success", "Linked — this device will keep syncing to the cloud automatically.");
        setShowConnect(false);
        setConnectPassword("");
        await refreshConnection();
        syncNow();
      }
    } finally {
      setConnecting(false);
    }
  };

  const columns: Column<AppUser>[] = [
    { header: "Name", render: (u) => <span className="font-bold text-white">{u.name}</span> },
    { header: "Email", render: (u) => <span className="font-mono text-slate-400">{u.email}</span> },
    {
      header: "Role",
      align: "center",
      render: (u) => (
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${u.role === "admin" ? "bg-blue-950 text-blue-400 border border-blue-800/50" : "bg-slate-950 text-slate-400 border border-slate-800"}`}>
          {roleLabel(u.role)}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "center",
      render: (u) => (
        <button
          onClick={() => setDeleting(u)}
          disabled={u.id === currentUser.id}
          className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none inline-flex items-center gap-1"
        >
          <IconTrash width={11} height={11} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="admin">
        Add a login for each person who needs to use the console — give them the{" "}
        <strong>Staff</strong> role unless they need cost/margin visibility and account
        management, which is <strong>Shop Owner</strong>-only. Cloud Backup below explains how
        your data gets saved.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Shop Settings</h2>
        <p className="text-xs text-slate-400">Manage staff accounts and shop details.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Shop Settings</h3>
          <form onSubmit={handleRenameShop} className="flex items-end gap-2">
            <div className="flex-1">
              <TextField label="Shop Name" value={shopName} onChange={setShopName} />
            </div>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Cloud Backup</h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Everything is always saved on this device first, so the shop keeps working with no
            internet at all. Whenever you&apos;re online, it pushes to your shop&apos;s database
            automatically in the background — nothing to turn on.
          </p>
          {connected ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Linked — syncing automatically whenever you&apos;re online.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                This device hasn&apos;t linked to the cloud yet (usually because it was set up
                offline). That normally finishes on its own the next time you&apos;re online — if
                it&apos;s been a while, you can finish it manually below.
              </p>
              <Button variant="secondary" onClick={() => setShowConnect(true)}>Finish Cloud Setup</Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Staff Accounts</h3>
        <Button onClick={() => setShowAdd(true)}>
          <IconPlus width={14} height={14} /> Add Staff
        </Button>
      </div>

      {loading ? <TableSkeleton rows={3} cols={4} /> : <DataTable columns={columns} rows={users} keyExtractor={(u) => u.id} emptyMessage="No staff accounts yet." />}

      {showAdd && (
        <Modal title="Add Staff Account" onClose={() => setShowAdd(false)}>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <TextField label="Full Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <TextField label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <TextField label="Password" type="password" required value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
            <SelectField
              label="Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v as Role })}
              options={[
                { value: "user", label: "Staff" },
                { value: "admin", label: "Shop Owner" },
              ]}
            />
            <p className="text-[10px] text-slate-500 leading-relaxed">This account can sign in on this device right away. It can&apos;t yet sign in on a different device — that needs a small cloud-provisioning step not built yet.</p>
            <Button type="submit" className="w-full">Create Account</Button>
          </form>
        </Modal>
      )}

      {showConnect && (
        <Modal title="Finish Cloud Setup" onClose={() => setShowConnect(false)}>
          <form onSubmit={handleConnect} className="space-y-3">
            <p className="text-[11px] text-slate-500">Re-enter your owner password to link this shop to the cloud. Needs internet for this one step — after that it's automatic.</p>
            <TextField label="Your Password" type="password" required value={connectPassword} onChange={setConnectPassword} />
            <Button type="submit" loading={connecting} className="w-full">Finish Linking</Button>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove Staff Account"
          message={`Remove ${deleting.name}'s access to MotoStock? This can't be undone.`}
          confirmLabel="Remove"
          onCancel={() => setDeleting(null)}
          onConfirm={handleDeleteUser}
        />
      )}
    </div>
  );
}
