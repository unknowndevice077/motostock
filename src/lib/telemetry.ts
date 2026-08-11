import { getSupabase } from "@/lib/supabase/client";

const INSTALL_ID_KEY = "motostock_install_id";

function getInstallId(): string {
  let id = localStorage.getItem(INSTALL_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(INSTALL_ID_KEY, id);
  }
  return id;
}

export interface TelemetryContext {
  shopId?: string | null;
  shopName?: string | null;
}

/**
 * Fire-and-forget usage ping for the developer's private "who's using this
 * and for what" view (Supabase Studio, not any in-app screen — see plan).
 * No-ops silently if no Supabase project is configured (fully offline
 * installs), and never throws or blocks the UI on failure.
 */
export function trackEvent(eventType: string, ctx: TelemetryContext = {}, metadata: Record<string, unknown> = {}): void {
  const supabase = getSupabase();
  if (!supabase) return;

  supabase
    .from("telemetry_events")
    .insert({
      shop_id: ctx.shopId ?? null,
      shop_name: ctx.shopName ?? null,
      install_id: getInstallId(),
      event_type: eventType,
      metadata,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
      os: typeof navigator !== "undefined" ? navigator.platform : null,
    })
    .then(({ error }) => {
      if (error) console.warn("[telemetry] ping failed (non-fatal):", error.message);
    });
}
