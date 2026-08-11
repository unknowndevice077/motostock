import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, or null if no project is configured
 * (e.g. running fully offline-only with no .env.local set up). Every caller
 * must handle the null case — cloud sync and telemetry are both optional,
 * the app works fully offline without either.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}

export function isCloudConfigured(): boolean {
  return Boolean(url && key);
}
