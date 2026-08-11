// Edge Function: creates a staff member's Supabase Auth login + app_users
// row, using the service-role key — which never leaves this server-side
// function and is never bundled into the desktop app.
//
// Why this can't just happen from the app: the client-side supabase-js
// signUp() call signs the *browser* in as whichever account it just
// created, which would kick the shop owner out of their own session the
// moment they add a staff member. Only the Auth Admin API (service role)
// can create a second account without disturbing the caller's session —
// and that key must live server-side only.
//
// Deploy: npx supabase functions deploy create-staff-account
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the platform — nothing to configure.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let body: { shopId?: string; staffId?: string; name?: string; email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const { shopId, staffId, name, email, password, role } = body;
  if (!shopId || !staffId || !name || !email || !password || !role) {
    return json({ error: "Missing required fields." }, 400);
  }
  if (role !== "admin" && role !== "user") {
    return json({ error: "Invalid role." }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not authenticated." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Step 1 — who is actually calling this, using their own token (not the
  // service role) so an expired/forged token is rejected the normal way.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: callerAuth, error: callerAuthError } = await callerClient.auth.getUser();
  if (callerAuthError || !callerAuth.user) {
    return json({ error: "Not authenticated." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Step 2 — the only authorization rule that matters here: the caller must
  // be an admin of THIS shop. Service role bypasses RLS, so this check is
  // the actual gate, not a formality.
  const { data: callerRow, error: callerRowError } = await admin
    .from("app_users")
    .select("role, shop_id")
    .eq("auth_user_id", callerAuth.user.id)
    .single();

  if (callerRowError || !callerRow || callerRow.role !== "admin" || callerRow.shop_id !== shopId) {
    return json({ error: "You don't have permission to add staff to this shop." }, 403);
  }

  // Step 3 — create the auth account (admin API: doesn't touch the
  // caller's session) and force it confirmed, since the owner is vouching
  // for this person directly rather than the usual self-signup flow.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Couldn't create the account." }, 400);
  }

  // Step 4 — same id as the local SQLite row, so local and cloud never
  // disagree on identity (mirrors how the owner's own row is provisioned).
  const { error: insertError } = await admin.from("app_users").upsert({
    id: staffId,
    shop_id: shopId,
    auth_user_id: created.user.id,
    name,
    email: email.toLowerCase().trim(),
    role,
  });
  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  return json({ ok: true }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
