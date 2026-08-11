"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/session";

const STALL_TIMEOUT_MS = 8000;

export default function RootRedirect() {
  const router = useRouter();
  const { loading, needsSetup, currentUser } = useAuth();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (needsSetup || !currentUser) router.replace("/login");
    else router.replace("/dashboard");
  }, [loading, needsSetup, currentUser, router]);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setStalled(true), STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (stalled) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-sm font-semibold text-amber-400">Taking longer than expected</p>
          <p className="text-xs text-slate-400">The local database didn't respond in time. This usually clears up on a reload.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-500 font-mono text-xs">
        <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
        Starting MotoStock...
      </div>
    </div>
  );
}
