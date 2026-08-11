-- Dev-only: monthly revenue per shop, derived from the sale_completed /
-- repair_job_completed telemetry pings shops already send (see
-- src/lib/telemetry.ts) — no new app code needed, this just reads data
-- that's already being collected. Query from Supabase Studio's SQL editor;
-- these views inherit telemetry_events' RLS, so they're only reachable with
-- the service role / dashboard, same as the underlying table — never by the
-- shipped app.
--
-- Usage: select * from shop_growth order by shop_name, month desc;

create or replace view shop_monthly_revenue as
select
  shop_id,
  shop_name,
  date_trunc('month', created_at) as month,
  count(*) as event_count,
  sum((metadata->>'total')::numeric) as revenue
from telemetry_events
where event_type in ('sale_completed', 'repair_job_completed')
  and metadata ? 'total'
group by shop_id, shop_name, date_trunc('month', created_at);

create or replace view shop_growth as
select
  shop_id,
  shop_name,
  month,
  revenue,
  event_count as transactions,
  lag(revenue) over (partition by shop_id order by month) as prior_month_revenue,
  round(
    case when lag(revenue) over (partition by shop_id order by month) > 0
      then (revenue - lag(revenue) over (partition by shop_id order by month))
           / lag(revenue) over (partition by shop_id order by month) * 100
      else null
    end,
    1
  ) as revenue_change_pct
from shop_monthly_revenue
order by shop_id, month;
