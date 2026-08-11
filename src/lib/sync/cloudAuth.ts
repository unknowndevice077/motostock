import { getSupabase } from "@/lib/supabase/client";
import type { Role } from "@/types";

export type ConnectResult = { ok: true } | { ok: false; error: string; needsEmailConfirmation?: boolean };

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

  let signUp = await supabase.auth.signUp({ email, password });
  if (signUp.error) {
    // Most likely: a previous attempt already created the auth account.
    const retry = await supabase.auth.signInWithPassword({ email, password });
    if (retry.error) return { ok: false, error: signUp.error.message };
    signUp = { data: retry.data, error: null } as typeof signUp;
  }

  if (!signUp.data.session) {
    return { ok: false, error: "Check your email to confirm your account, then try connecting again.", needsEmailConfirmation: true };
  }

  const authUserId = signUp.data.user!.id;

  const { error: shopError } = await supabase.from("shops").upsert({ id: shopId, name: shopName });
  if (shopError) return { ok: false, error: shopError.message };

  const { error: userError } = await supabase.from("app_users").upsert({
    id: adminId,
    shop_id: shopId,
    auth_user_id: authUserId,
    name: adminName,
    email: email.toLowerCase().trim(),
    role: "admin",
  });
  if (userError) return { ok: false, error: userError.message };

  return { ok: true };
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

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError || !signInData.session) {
    return { ok: false, error: "Couldn't sign in. Check your email and password, or this shop may not be connected to the cloud yet." };
  }

  const { data: userRow, error: userError } = await supabase
    .from("app_users")
    .select("id, shop_id, name, email, role")
    .eq("auth_user_id", signInData.user.id)
    .single();
  if (userError || !userRow) return { ok: false, error: "Signed in, but no shop membership was found for this account." };

  const { data: shopRow, error: shopError } = await supabase.from("shops").select("id, name").eq("id", userRow.shop_id).single();
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
}

export async function isCloudConnected(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
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
