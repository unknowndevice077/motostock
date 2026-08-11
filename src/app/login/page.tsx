"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";

// Local-device only convenience for a shared shop terminal — never synced or
// sent anywhere. Storing a plaintext password is a deliberate tradeoff for
// "don't make staff retype it after every lock"; anyone with access to this
// device already has access to the app, so it isn't raising the real risk.
const REMEMBER_KEY = "motostock_remembered_login";

export default function LoginPage() {
  const router = useRouter();
  const { loading, needsSetup, currentUser, login, completeSetup, joinShop } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (!saved) return;
    try {
      const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRemember(true);
      }
    } catch {
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  const [shopName, setShopName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [setupMode, setSetupMode] = useState<"create" | "join">("create");

  useEffect(() => {
    if (!loading && currentUser) router.replace("/dashboard");
  }, [loading, currentUser, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await login(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Login failed.");
      return;
    }
    if (remember) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
    else localStorage.removeItem(REMEMBER_KEY);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!shopName || !adminName || !email || !password) {
      setError("All fields are required to set up your shop.");
      return;
    }
    setBusy(true);
    try {
      await completeSetup(shopName, adminName, email, password);
    } catch (err) {
      console.error("Shop setup failed:", err);
      const message = err instanceof Error ? err.message : String(err);
      setError(`Could not set up the shop: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result = await joinShop(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not join that shop.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-4 py-12 font-sans animate-fadeIn">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white">M</div>
          <div>
            <p className="text-base font-semibold text-white">MotoStock</p>
            <p className="text-xs text-slate-500">Parts inventory, repairs & POS</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          {needsSetup ? (
            <>
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 mb-5">
                <button type="button" onClick={() => { setSetupMode("create"); setError(""); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${setupMode === "create" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  New shop
                </button>
                <button type="button" onClick={() => { setSetupMode("join"); setError(""); }} className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 ${setupMode === "join" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  Join existing shop
                </button>
              </div>

              {setupMode === "create" ? (
                <>
                  <h1 className="text-base font-semibold text-white mb-1">Set up your shop</h1>
                  <p className="text-xs text-slate-500 mb-5">First run on this device — create your shop and owner account.</p>
                  <form onSubmit={handleSetup} className="space-y-3">
                    <Field label="Shop name" value={shopName} onChange={setShopName} placeholder="e.g. Downtown Moto Parts" />
                    <Field label="Your name" value={adminName} onChange={setAdminName} placeholder="Owner full name" />
                    <Field label="Email" value={email} onChange={setEmail} placeholder="you@shop.com" type="email" />
                    <Field label="Password" value={password} onChange={setPassword} placeholder="Choose a password" type="password" />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <Button type="submit" loading={busy} className="w-full mt-1">Create shop &amp; owner account</Button>
                  </form>
                </>
              ) : (
                <>
                  <h1 className="text-base font-semibold text-white mb-1">Join your shop</h1>
                  <p className="text-xs text-slate-500 mb-5">This shop is already set up on another device. Sign in with your owner account to pull its data down here — needs internet for this one step.</p>
                  <form onSubmit={handleJoin} className="space-y-3">
                    <Field label="Email" value={email} onChange={setEmail} placeholder="you@shop.com" type="email" />
                    <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••••" type="password" />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <Button type="submit" loading={busy} className="w-full mt-1">Join &amp; sync this device</Button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="text-base font-semibold text-white mb-1">Sign in</h1>
              <p className="text-xs text-slate-500 mb-5">Enter your staff credentials to open the console.</p>
              <form onSubmit={handleLogin} className="space-y-3">
                <Field label="Email" value={email} onChange={setEmail} placeholder="you@shop.com" type="email" />
                <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••••" type="password" />
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-blue-500 w-3.5 h-3.5" />
                  Remember my password on this device
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <Button type="submit" loading={busy} className="w-full mt-1">Sign in</Button>
              </form>
              <p className="text-center text-[11px] text-slate-600 mt-4">
                Don&apos;t have a login? Ask your shop owner to add you from Shop Settings &rarr; Staff Accounts.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-600">Works fully offline. Syncs automatically when online.</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors duration-150"
      />
    </div>
  );
}
