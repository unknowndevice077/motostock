import { getSupabase } from "@/lib/supabase/client";

export interface PhoneSession {
  id: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
}

const SESSION_HOURS = 12; // roughly a work shift

function mapSession(row: Record<string, unknown>): PhoneSession {
  return {
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    revokedAt: (row.revoked_at as string | null) ?? null,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
  };
}

/**
 * Creates a pairing session and returns the QR URL for it. The session's own
 * id IS the pairing token — a fresh gen_random_uuid() per row is already
 * unguessable, so there's no separate token column (see
 * supabase/migrations/0004_phone_scan.sql). Existing sessions aren't
 * affected — a shop can have more than one phone paired at once.
 */
export async function createPairingSession(shopId: string, createdBy: string | null): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: "No cloud project configured." };

  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("phone_sessions")
    .insert({ shop_id: shopId, created_by: createdBy, expires_at: expiresAt })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't create a pairing code." };

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return { ok: false, error: "Cloud project URL isn't configured." };
  return { ok: true, url: `${base}/functions/v1/scan-relay?token=${data.id}` };
}

/** Sessions not yet expired or revoked, most recently active first. */
export async function listActivePhoneSessions(shopId: string): Promise<PhoneSession[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("phone_sessions")
    .select("*")
    .eq("shop_id", shopId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapSession);
}

export async function revokePhoneSession(id: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("phone_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", id);
}
