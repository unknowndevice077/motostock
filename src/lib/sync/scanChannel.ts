import { getSupabase } from "@/lib/supabase/client";

export interface ScanEvent {
  id: string;
  partId: string | null;
  partName: string;
  partNumber: string;
  stock: number;
  createdAt: string;
}

function mapEvent(row: Record<string, unknown>): ScanEvent {
  return {
    id: row.id as string,
    partId: (row.part_id as string | null) ?? null,
    partName: row.part_name as string,
    partNumber: row.part_number as string,
    stock: row.stock as number,
    createdAt: row.created_at as string,
  };
}

/**
 * Live feed of scan_events for this shop via Supabase Realtime — fires the
 * instant scan-relay inserts a row, no polling. Returns an unsubscribe
 * function; no-ops (never fires) if cloud isn't configured.
 */
export function subscribeScanEvents(shopId: string, onEvent: (event: ScanEvent) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`scan-events-${shopId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "scan_events", filter: `shop_id=eq.${shopId}` },
      (payload) => onEvent(mapEvent(payload.new as Record<string, unknown>))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Most recent scans for the initial list on the Phone Scanner page (the
 * Realtime subscription only carries new events going forward). */
export async function listRecentScans(shopId: string, limit = 30): Promise<ScanEvent[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("scan_events")
    .select("*")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapEvent);
}
