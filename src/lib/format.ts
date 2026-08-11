/** Shop currency is Philippine peso throughout the app. */
export function formatCurrency(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * "admin"/"user" are the internal role identifiers (used in the DB, sync,
 * and Supabase RLS policies) — never rename those. This is only what gets
 * displayed to people, who think in terms of the shop owner vs. the staff
 * they hire, not software-style "admin" accounts.
 */
export function roleLabel(role: "admin" | "user"): string {
  return role === "admin" ? "Shop Owner" : "Staff";
}
