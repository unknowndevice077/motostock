"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/session";
import { useToast } from "@/components/ui/Toast";
import { listUsers, createUser, deleteUser, markCloudProvisioned } from "@/lib/db/users";
import { renameShop } from "@/lib/db/shops";
import { provisionStaffInCloud } from "@/lib/sync/cloudAuth";
import { useSync } from "@/lib/sync/SyncProvider";
import type { AppUser, Role } from "@/types";
import { roleLabel } from "@/lib/format";
import { resizeToFitDataUrl } from "@/lib/image";
import { getCached, setCached } from "@/lib/db/cache";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { TextField, SelectField } from "@/components/ui/FormField";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { HelpTip } from "@/components/ui/HelpTip";
import { IconPlus, IconTrash, IconUpload } from "@/components/ui/icons";

export default function AdminPage() {
  const { shop, currentUser, refreshShop, setShopLogo } = useAuth();
  const { connected } = useSync();
  const { push } = useToast();

  const logoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [users, setUsers] = useState<AppUser[]>(() => (shop && getCached<AppUser[]>(`app_users:${shop.id}`)) || []);
  const [loading, setLoading] = useState(() => !(shop && getCached(`app_users:${shop.id}`)));
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const [shopName, setShopName] = useState(shop?.name ?? "");

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as Role });

  const reload = async () => {
    if (!shop) return;
    const fresh = await listUsers(shop.id);
    setCached(`app_users:${shop.id}`, fresh);
    setUsers(fresh);
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
    const staff = await createUser(shop.id, form.name, form.email, form.password, form.role);
    setForm({ name: "", email: "", password: "", role: "user" });
    setShowAdd(false);
    push("success", `${form.name} added as ${roleLabel(form.role)}.`);
    reload();

    // Best-effort: lets them sign in on a different device too. Never
    // blocks — the account already works on this device regardless.
    if (connected) {
      const result = await provisionStaffInCloud({
        shopId: shop.id,
        staffId: staff.id,
        name: staff.name,
        email: form.email,
        password: form.password,
        role: staff.role,
      });
      if (result.ok === false) {
        push("info", `${staff.name} can sign in here, but not on another device yet: ${result.error}`);
      } else {
        await markCloudProvisioned(staff.id);
      }
    }
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

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push("error", "Please choose an image file.");
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await resizeToFitDataUrl(file);
      await setShopLogo(dataUrl);
      push("success", "Shop logo updated.");
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Couldn't update the logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    await setShopLogo(null);
    push("info", "Shop logo removed.");
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
        management, which is <strong>Shop Owner</strong>-only. Everything backs up to the cloud
        automatically — check the dot next to your shop name in the sidebar for status.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white">Shop Settings</h2>
        <p className="text-xs text-slate-400">Manage staff accounts and shop details.</p>
      </div>

      <div className="max-w-md">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">Shop Details</h3>

          <div className="flex items-center gap-4">
            <div className="shrink-0">
              {shop?.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo} alt={shop.name} className="h-14 w-14 rounded-lg object-contain bg-slate-950 border border-slate-800 p-1" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-lg font-bold text-slate-500">
                  {shop?.name.charAt(0).toUpperCase() ?? "M"}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <input ref={logoFileRef} type="file" accept="image/*" onChange={handleLogoFile} className="hidden" />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" loading={uploadingLogo} onClick={() => logoFileRef.current?.click()}>
                  <IconUpload width={12} height={12} /> Upload Logo
                </Button>
                {shop?.logo && (
                  <button onClick={handleRemoveLogo} className="text-[10px] bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/40 px-2 py-1 rounded font-mono transition-all duration-150">
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500">Shown in the sidebar and on printed receipts/invoices.</p>
            </div>
          </div>

          <form onSubmit={handleRenameShop} className="flex items-end gap-2 pt-1 border-t border-slate-800">
            <div className="flex-1 pt-3">
              <TextField label="Shop Name" value={shopName} onChange={setShopName} />
            </div>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
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
            <p className="text-[10px] text-slate-500 leading-relaxed">
              This account can sign in on this device right away.{" "}
              {connected
                ? "They'll be able to sign in on another device too."
                : "It won't be able to sign in on another device yet — that finishes automatically once this shop backs up to the cloud."}
            </p>
            <Button type="submit" className="w-full">Create Account</Button>
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
