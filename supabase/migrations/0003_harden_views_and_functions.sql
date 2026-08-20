-- Security fixes found by a Supabase advisor scan (2026-08-20):
--
-- 1. shop_monthly_revenue / shop_growth (0002_shop_growth_view.sql) were
--    plain views, which in Postgres run with the OWNER's privileges against
--    underlying tables by default — silently bypassing telemetry_events'
--    RLS (which has NO select policy for anon/authenticated at all, on
--    purpose). Any signed-in user from ANY shop could have queried these via
--    the auto-generated REST API and seen every shop's revenue, despite the
--    comment in 0002 claiming otherwise. security_invoker makes them respect
--    the QUERYING user's own permissions instead, so they now correctly
--    return nothing for anon/authenticated (matching the original intent —
--    dashboard/service-role only) and still work fine from Studio.
alter view shop_monthly_revenue set (security_invoker = true);
alter view shop_growth set (security_invoker = true);

-- 2. Pin search_path on the two SECURITY DEFINER helper functions so they
--    can't be tricked by a search_path swap into resolving app_users (etc.)
--    from an attacker-controlled schema. Same bodies, just with search_path
--    fixed instead of left mutable.
create or replace function current_shop_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select shop_id from app_users where auth_user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from app_users where auth_user_id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

-- Not touched: current_shop_id()/is_admin() are still callable via RPC by
-- anon/authenticated (flagged WARN) — intentional, they only ever reveal the
-- CALLING user's own shop/role, and every RLS policy in this schema calls
-- them as the querying role, so revoking EXECUTE would break the app.
-- rls_auto_enable() is a Supabase-platform event-trigger function (auto-
-- enables RLS on any new public table); Postgres refuses to invoke event
-- trigger functions directly regardless of caller, so the WARN is a
-- reviewed false positive.
