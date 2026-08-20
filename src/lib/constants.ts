export const PART_CATEGORIES = ["Engine", "Brakes", "Electrical", "Accessories"] as const;
export const MOTORCYCLE_CATEGORIES = ["Sport", "Scooter", "Naked", "Off-Road"] as const;

/** Local accounts have no length rule of their own, but Supabase Auth
 * rejects anything shorter than this — enforcing it here at creation time
 * means an account can never end up locally-usable but cloud-unconnectable. */
export const MIN_PASSWORD_LENGTH = 6;
