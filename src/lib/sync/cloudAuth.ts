import { getSupabase } from "@/lib/supabase/client";
import { withTimeout } from "./withTimeout";
import type { Role } from "@/types";

export type ConnectResult = { ok: true } | { ok: false; error: string; needsEmailConfirmation?: boolean };

const CLOUD_TIMEOUT_MS = 20000; // generous enough for a free-tier project waking from pause, never indefinite

/**
 * First-time cloud provisioning for a brand-new shop: creates the Supabase
 * Auth account for the admin, then the shops + app_users rows in Postgres
 * using the SAME ids as the local SQLite rows, so local and cloud never
 * disagree on identity. Safe to call again if a prior attempt partially
 * failed (e.g. network dropped after the auth account was created).
 */
export async function provisionShopInCloud(params: {
  shopId: string;
  shopName: string;
  adminId: string;
  adminName: string;
  email: string;
  password: string;
}): Promise<ConnectResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "No cloud project configured." };

  const { shopId, shopName, adminId, adminName, email, password } = params;

  try {
    let signUp = await withTimeout(supabase.auth.signUp({ email, password }), CLOUD_TIMEOUT_MS, "Sign-up");
    if (signUp.error) {
      // Most likely: a previous attempt already created the auth account.
      const retry = await withTimeout(supabase.auth.signInWithPassword({ email, password }), CLOUD_TIMEOUT_MS, "Sign-in");
      if (retry.error) return { ok: false, error: signUp.error.message };
      signUp = { data: retry.data, error: null } as typeof signUp;
    }

    if (!signUp.data.session) {
      return { ok: false, error: "Check your email to confirm your account, then try connecting again.", needsEmailConfirmation: true };
    }

    const authUserId = signUp.data.user!.id;

    const { error: shopError } = await withTimeout(supabase.from("shops").upsert({ id: shopId, name: shopName }), CLOUD_TIMEOUT_MS, "Shop setup");
    if (shopError) return { ok: false, error: shopError.message };

    const { error: userError } = await withTimeout(
      supabase.from("app_users").upsert({
        id: adminId,
        shop_id: shopId,
        auth_user_id: authUserId,
        name: adminName,
        email: email.toLowerCase().trim(),
        role: "admin",
      }),
      CLOUD_TIMEOUT_MS,
      "Account setup"
    );
    if (userError) return { ok: false, error: userError.message };

    return { ok: true };
  } catch (err) {
    // Covers a timed-out call above and any other unexpected network/client
    // exception — this boundary always returns a clean result, never throws,
    // so a stalled connection can't leave a caller's "loading" state stuck
    // forever with no error surfaced.
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach the cloud." };
  }
}

export interface RemoteShopMembership {
  shopId: string;
  shopName: string;
  appUserId: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * Signs in to an existing cloud-connected shop from a fresh device. Returns
 * enough to hydrate a local SQLite database from scratch (see sync/hydrate.ts).
 */
export async function joinExistingShop(email: string, password: string): Promise<{ ok: true; membership: RemoteShopMembership } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "No cloud project configured." };

  try {
    const { data: signInData, error: signInError } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), CLOUD_TIMEOUT_MS, "Sign-in");
    if (signInError || !signInData.session) {
      return { ok: false, error: "Couldn't sign in. Check your email and password, or this shop may not be connected to the cloud yet." };
    }

    const { data: userRow, error: userError } = await withTimeout(
      supabase.from("app_users").select("id, shop_id, name, email, role").eq("auth_user_id", signInData.user.id).single(),
      CLOUD_TIMEOUT_MS,
      "Loading account"
    );
    if (userError || !userRow) return { ok: false, error: "Signed in, but no shop membership was found for this account." };

    const { data: shopRow, error: shopError } = await withTimeout(
      supabase.from("shops").select("id, name").eq("id", userRow.shop_id).single(),
      CLOUD_TIMEOUT_MS,
      "Loading shop"
    );
    if (shopError || !shopRow) return { ok: false, error: "Signed in, but couldn't load the shop record." };

    return {
      ok: true,
      membership: {
        shopId: shopRow.id,
        shopName: shopRow.name,
        appUserId: userRow.id,
        name: userRow.name,
        email: userRow.email,
        role: userRow.role,
      },
    };
  } catch (err) {
    // Same rationale as provisionShopInCloud above — never let a stalled
    // network call throw out of this boundary and strand the caller's
    // "loading" state with no error shown.
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach the cloud." };
  }
}

/**
 * True only when there's both a valid session AND that account actually has
 * a shop membership row in the cloud — not just a session token. A session
 * alone isn't enough: if a prior provisioning attempt got as far as signing
 * up/in but failed before creating the shops/app_users rows (e.g. hit an
 * RLS bug, lost connection mid-way), the session persists on its own and
 * would otherwise make every screen believe the shop is connected forever,
 * silently failing every cloud write with no way back to the "Connect to
 * Cloud" screen that would actually fix it. The app_users SELECT policy
 * explicitly allows a signed-in user to see their own row regardless of
 * shop resolution (see supabase/migrations/0005_fix_bootstrap_rls.sql), so
 * this check works even for an account that never finished provisioning.
 */
export async function isCloudConnected(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;

  const { data: membership } = await supabase
    .from("app_users")
    .select("id")
    .eq("auth_user_id", data.session.user.id)
    .maybeSingle();
  return Boolean(membership);
}

/**
 * Best-effort: cloud-provisions a staff account via the create-staff-account
 * Edge Function, so they can sign in on a different device later. Requires
 * the calling admin to already be cloud-connected (their session is what
 * authorizes the request) and the function to be deployed — silently no-ops
 * otherwise, same as owner provisioning at setup, since the shop must stay
 * fully usable locally either way.
 */
export async function provisionStaffInCloud(params: {
  shopId: string;
  staffId: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<ConnectResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "No cloud project configured." };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return { ok: false, error: "This device isn't linked to the cloud yet." };

  const { data, error } = await supabase.functions.invoke("create-staff-account", { body: params });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}
