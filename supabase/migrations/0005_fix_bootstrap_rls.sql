-- Fixes a real bug (not the app code): first-time cloud provisioning of a
-- brand-new shop could never succeed, because current_shop_id() depends on
-- an app_users row that doesn't exist yet at the exact moment it's being
-- created. PostgREST's insert/upsert always does an internal `RETURNING`
-- (even under `Prefer: return=minimal`, to count affected rows), and that
-- RETURNING is gated by each table's SELECT policy. Since shops/app_users'
-- SELECT policies gate on current_shop_id(), the very first row a new admin
-- ever creates was invisible to its own insert, so Postgres rejected the
-- whole statement with "new row violates row-level security policy" even
-- though the INSERT policy itself was satisfied. Confirmed by reproducing
-- the exact failure against a disposable test table with a trivial
-- `with check (true)` policy — it's the RETURNING/SELECT step, not the
-- INSERT check, that fails.
--
-- Fix: let a user always see (a) a shop while they don't yet belong to any
-- shop (the narrow bootstrap window — always false again the instant their
-- own app_users row exists, so no ongoing exposure beyond that moment) and
-- (b) their own app_users row regardless of shop resolution (obviously safe
-- — a user can always see their own membership record).

drop policy if exists "shop members can read their shop" on shops;
create policy "shop members can read their shop" on shops
  for select
  using (
    id = current_shop_id()
    or not exists (select 1 from app_users where auth_user_id = auth.uid())
  );

drop policy if exists "shop members can read shop users" on app_users;
create policy "shop members can read shop users" on app_users
  for select
  using (
    shop_id = current_shop_id()
    or auth_user_id = auth.uid()
  );
