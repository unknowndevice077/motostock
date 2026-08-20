"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "@/lib/auth/session";
import { useSync } from "@/lib/sync/SyncProvider";
import { useScan } from "@/lib/sync/ScanProvider";
import { provisionShopInCloud } from "@/lib/sync/cloudAuth";
import { markCloudProvisioned } from "@/lib/db/users";
import { createPairingSession, listActivePhoneSessions, revokePhoneSession, type PhoneSession } from "@/lib/sync/scanSession";
import { listRecentScans, type ScanEvent } from "@/lib/sync/scanChannel";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/FormField";
import { HelpTip } from "@/components/ui/HelpTip";
import { useToast } from "@/components/ui/Toast";
import { IconPhoneScan, IconTrash } from "@/components/ui/icons";

/** Inline, one-field version of "connect to the cloud" — no full logout
 * needed. Supabase Auth requires the actual password to create a session,
 * and this app deliberately never stores that anywhere (only a local hash),
 * so somewhere still has to ask for it once — this is that one place,
 * instead of forcing a whole sign-out/sign-in cycle to reach the same code
 * path. Admin-only: provisionShopInCloud always upserts the caller as the
 * shop's admin record, which would be wrong for a staff account. */
function ConnectCloudPrompt() {
  const { shop, currentUser, refreshShop } = useAuth();
  const { refreshConnection } = useSync();
  const { push } = useToast();
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = currentUser?.role === "admin";

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !currentUser || !password) return;
    setConnecting(true);
    setError("");
    try {
      const result = await provisionShopInCloud({
        shopId: shop.id,
        shopName: shop.name,
        adminId: currentUser.id,
        adminName: currentUser.name,
        email: currentUser.email,
        password,
      });
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      await markCloudProvisioned(currentUser.id);
      await refreshConnection();
      await refreshShop();
      push("success", "Connected — the shop is now linked to the cloud.");
      setPassword("");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
      <div className="max-w-xs mx-auto">
        <p className="text-xs text-slate-400 mb-4">
          Phone scanning needs the shop linked to the cloud — that&apos;s how the phone and the laptop
          talk to each other. This only needs to happen once, ever; after that it stays connected on
          its own.
        </p>
        {isAdmin ? (
          <form onSubmit={handleConnect} className="space-y-3 text-left">
            <TextField label="Your password" type="password" required value={password} onChange={setPassword} placeholder="Confirm it's you, then we'll handle the rest" />
            {error && <p className="text-[11px] text-red-400">{error}</p>}
            <Button type="submit" className="w-full" loading={connecting} disabled={!password}>
              Connect to Cloud
            </Button>
          </form>
        ) : (
          <p className="text-xs text-amber-400">Ask the shop owner to open this page and connect once — after that, your account connects automatically.</p>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ScannerPage() {
  const { shop, currentUser } = useAuth();
  const { connected } = useSync();
  const { recentScans: liveScans } = useScan();
  const { push } = useToast();

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sessions, setSessions] = useState<PhoneSession[]>([]);
  const [history, setHistory] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSessions = useCallback(async () => {
    if (!shop) return;
    setSessions(await listActivePhoneSessions(shop.id));
  }, [shop]);

  useEffect(() => {
    if (!shop) return;
    Promise.all([listActivePhoneSessions(shop.id), listRecentScans(shop.id)]).then(([s, h]) => {
      setSessions(s);
      setHistory(h);
      setLoading(false);
    });
  }, [shop]);

  const handleNewPairing = async () => {
    if (!shop) return;
    setGenerating(true);
    try {
      const result = await createPairingSession(shop.id, currentUser?.id ?? null);
      if (result.ok === false) {
        push("error", result.error);
        return;
      }
      setQrDataUrl(await QRCode.toDataURL(result.url, { margin: 1, width: 220, color: { dark: "#0f172a", light: "#ffffff" } }));
      await refreshSessions();
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await revokePhoneSession(id);
    await refreshSessions();
  };

  // Merge the live Realtime feed with the initial history fetch, newest
  // first, deduped by id — a scan already in history shouldn't double up
  // when it also arrives live.
  const combinedScans = useMemo(() => {
    const byId = new Map<string, ScanEvent>();
    for (const s of [...liveScans, ...history]) byId.set(s.id, s);
    return Array.from(byId.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [liveScans, history]);

  if (!connected) {
    return (
      <div className="space-y-6 animate-slideUp">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <IconPhoneScan width={18} height={18} className="text-slate-300" /> Phone Scanner
          </h2>
        </div>
        <ConnectCloudPrompt />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slideUp">
      <HelpTip id="scanner">
        Scan the QR below with your phone&apos;s camera — it opens a scanner page in the phone&apos;s
        browser, no app to install, no login. Pick a repair job right on the phone before scanning
        to charge parts straight to that job, or leave it on &quot;General inventory&quot; for a plain
        lookup. Every scan shows up here and pops up as a notification anywhere in the app.
      </HelpTip>

      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <IconPhoneScan width={18} height={18} className="text-slate-300" /> Phone Scanner
        </h2>
        <p className="text-xs text-slate-400">Pair a phone to use its camera as a QR scanner.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col items-center text-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Pair a Phone</h3>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Scan with your phone to pair" className="w-44 h-44 rounded-lg" />
          ) : (
            <div className="w-44 h-44 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
              <p className="text-[11px] text-slate-600 font-mono px-4">No active code — generate one below</p>
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-3 mb-3">Valid for 12 hours. Existing paired phones stay connected.</p>
          <Button onClick={handleNewPairing} loading={generating} className="w-full">
            {qrDataUrl ? "Generate New Code" : "Generate Pairing Code"}
          </Button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Connected Phones</h3>
          {loading ? (
            <p className="text-[11px] text-slate-500 font-mono">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-[11px] text-slate-600 font-mono py-6 text-center">No phones paired yet.</p>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-200">{s.label || "Phone"}</p>
                    <p className="text-[9px] text-slate-500 font-mono">Last scan: {timeAgo(s.lastSeenAt)}</p>
                  </div>
                  <button onClick={() => handleRevoke(s.id)} title="Disconnect" className="text-slate-500 hover:text-red-400 shrink-0 p-1">
                    <IconTrash width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono mb-3">Recent Scans</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {combinedScans.length === 0 && <p className="text-[11px] text-slate-600 font-mono py-6 text-center">Nothing scanned yet.</p>}
            {combinedScans.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-200 truncate">
                    {s.partName} {s.repairJobId && <span className="text-[8px] font-mono uppercase text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 rounded px-1 py-0.5 ml-1">→ open job</span>}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono truncate">{s.partNumber} · {timeAgo(s.createdAt)}</p>
                </div>
                <span className="text-[10px] font-mono font-bold text-slate-400 shrink-0 ml-2">{s.stock} left</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
