"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AppUser, Shop } from "@/types";
import { createShop, getCurrentShop, upsertLocalShop, updateShopLogo } from "@/lib/db/shops";
import { createUser, getUserById, verifyLogin, upsertLocalUser, updateAvatar, isCloudProvisioned, markCloudProvisioned } from "@/lib/db/users";
import { trackEvent } from "@/lib/telemetry";
import { provisionShopInCloud, provisionStaffInCloud, joinExistingShop, isCloudConnected } from "@/lib/sync/cloudAuth";
import { runSync } from "@/lib/sync/engine";

const SESSION_KEY = "motostock_session_user_id";

interface AuthContextValue {
  loading: boolean;
  shop: Shop | null;
  currentUser: AppUser | null;
  /** True when no shop exists yet on this install — show the first-run setup wizard. */
  needsSetup: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  completeSetup: (shopName: string, adminName: string, email: string, password: string) => Promise<void>;
  /** Signs in to an existing cloud-connected shop from a fresh install and hydrates this device from it. */
  joinShop: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  refreshShop: () => Promise<void>;
  /** Updates the signed-in user's profile picture (local-only for now). */
  setAvatar: (dataUrl: string | null) => Promise<void>;
  /** Updates the shop's logo (local-only for now). */
  setShopLogo: (dataUrl: string | null) => Promise<void>;
  /** Dev-only usage ping, auto-tagged with this shop. See src/lib/telemetry.ts. */
  track: (eventType: string, metadata?: Record<string, unknown>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<Shop | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const existingShop = await getCurrentShop();
      setShop(existingShop);

      if (existingShop) {
        // Offline session cache: once a device has logged in, it stays logged
        // in locally without re-entering a password (Supabase Auth will add
        // a real online-verified path alongside this later).
        const cachedId = localStorage.getItem(SESSION_KEY);
        if (cachedId) {
          const user = await getUserById(cachedId);
          if (user) setCurrentUser(user);
          else localStorage.removeItem(SESSION_KEY);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    async (email: string, password: string) => {
      const user = await verifyLogin(email, password);
      if (!user) return { ok: false, error: "Invalid email or password." };
      localStorage.setItem(SESSION_KEY, user.id);
      setCurrentUser(user);

      // Cloud linking is meant to be invisible — no separate "connect"
      // screen for anyone to find. If this shop was set up offline and
      // never got its first cloud connection, piggyback on the owner's next
      // password entry to finish it silently in the background. Never
      // blocks or delays sign-in either way.
      if (user.role === "admin" && shop) {
        isCloudConnected().then(async (connected) => {
          if (connected) return;
          const result = await provisionShopInCloud({ shopId: shop.id, shopName: shop.name, adminId: user.id, adminName: user.name, email, password }).catch(() => null);
          if (result?.ok) await markCloudProvisioned(user.id);
        });
      }

      // Same idea for staff: if they were added before the shop had backed
      // up to the cloud yet, their own cloud login never got created. Their
      // password only ever exists in memory for the moment they type it —
      // so retry right here, using this login, rather than storing it.
      if (user.role === "user" && shop) {
        isCloudProvisioned(user.id).then(async (provisioned) => {
          if (provisioned) return;
          if (!(await isCloudConnected())) return;
          const result = await provisionStaffInCloud({ shopId: shop.id, staffId: user.id, name: user.name, email, password, role: user.role });
          if (result.ok) await markCloudProvisioned(user.id);
        });
      }

      return { ok: true };
    },
    [shop]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  const completeSetup = useCallback(async (shopName: string, adminName: string, email: string, password: string) => {
    const newShop = await createShop(shopName);
    const admin = await createUser(newShop.id, adminName, email, password, "admin");
    setShop(newShop);
    localStorage.setItem(SESSION_KEY, admin.id);
    setCurrentUser(admin);

    // Best-effort cloud connect: never blocks local setup, which always
    // succeeds regardless of network. If this fails (offline, etc.) the shop
    // stays fully functional locally, and login() retries this silently the
    // next time the owner signs in while online — no separate step to find.
    try {
      const result = await provisionShopInCloud({ shopId: newShop.id, shopName: newShop.name, adminId: admin.id, adminName: admin.name, email, password });
      if (result.ok) await markCloudProvisioned(admin.id);
    } catch {
      // offline or cloud not configured — fine, stays local-only for now.
    }
  }, []);

  const joinShop = useCallback(async (email: string, password: string) => {
    const result = await joinExistingShop(email, password);
    if (result.ok === false) return { ok: false, error: result.error };

    const { membership } = result;
    const joinedShop = await upsertLocalShop(membership.shopId, membership.shopName);
    const user = await upsertLocalUser(membership.appUserId, membership.shopId, membership.name, membership.email, password, membership.role);
    setShop(joinedShop);
    localStorage.setItem(SESSION_KEY, user.id);
    setCurrentUser(user);

    // Pull down everything this shop already has in the cloud (parts, sales,
    // repair jobs, ...) — sync_meta is empty on this fresh device, so the
    // first cycle naturally hydrates the whole shop.
    await runSync(membership.shopId);

    return { ok: true };
  }, []);

  const setAvatar = useCallback(
    async (dataUrl: string | null) => {
      if (!currentUser) return;
      await updateAvatar(currentUser.id, dataUrl);
      setCurrentUser({ ...currentUser, avatar: dataUrl });
    },
    [currentUser]
  );

  const setShopLogo = useCallback(
    async (dataUrl: string | null) => {
      if (!shop) return;
      await updateShopLogo(shop.id, dataUrl);
      setShop({ ...shop, logo: dataUrl });
    },
    [shop]
  );

  const track = useCallback(
    (eventType: string, metadata?: Record<string, unknown>) => {
      trackEvent(eventType, { shopId: shop?.id, shopName: shop?.name }, metadata);
    },
    [shop]
  );

  const value: AuthContextValue = {
    loading,
    shop,
    currentUser,
    needsSetup: !loading && !shop,
    login,
    logout,
    completeSetup,
    joinShop,
    refreshShop: bootstrap,
    setAvatar,
    setShopLogo,
    track,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
