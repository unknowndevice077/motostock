-- MotoStock cloud schema (Postgres / Supabase).
--
-- This mirrors the local SQLite schema (src-tauri/migrations/0001_init.sql)
-- and is the sync target once a shop's device is online. Every shop's rows
-- are isolated by Row Level Security keyed off shop_id, so the public
-- (anon/publishable) key this app ships with can never see across shops.
--
-- telemetry_events lives in this same project (by choice, for simplicity)
-- but is locked to INSERT-only for the public key — the shipped app can
-- write usage events, it can never read them back. View them in the
-- Supabase Studio table editor / SQL editor, not in the app.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shops & staff
-- ---------------------------------------------------------------------------

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Looks up the shop of the currently-authenticated user. Security definer so
-- it can read app_users regardless of the caller's own row-level access.
create or replace function current_shop_id()
returns uuid
language sql
security definer
stable
as $$
  select shop_id from app_users where auth_user_id = auth.uid() and deleted_at is null limit 1;
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from app_users where auth_user_id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  part_name text not null,
  part_number text not null,
  category text not null check (category in ('Engine', 'Brakes', 'Electrical', 'Accessories')),
  stock integer not null default 0,
  min_threshold integer not null default 0,
  cost_price numeric not null default 0,
  selling_price numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists motorcycles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  model_name text not null,
  vin text not null,
  displacement text,
  category text not null check (category in ('Sport', 'Scooter', 'Naked', 'Off-Road')),
  price numeric not null default 0,
  cost numeric not null default 0,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid references app_users(id),
  customer_name text,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  part_id uuid not null references parts(id),
  part_name text not null,
  part_number text not null,
  qty integer not null,
  unit_price numeric not null
);

create table if not exists repair_jobs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid references app_users(id),
  customer_name text not null,
  customer_phone text,
  motorcycle_desc text,
  status text not null check (status in ('open', 'in_progress', 'completed')) default 'open',
  labor_fee numeric not null default 0,
  notes text,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists repair_job_parts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references repair_jobs(id) on delete cascade,
  part_id uuid not null references parts(id),
  part_name text not null,
  part_number text not null,
  qty integer not null,
  unit_price numeric not null
);

create table if not exists stock_receipts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  part_id uuid not null references parts(id),
  user_id uuid references app_users(id),
  qty integer not null,
  unit_cost numeric not null default 0,
  supplier text,
  reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_users_shop on app_users(shop_id);
create index if not exists idx_parts_shop on parts(shop_id);
create index if not exists idx_motorcycles_shop on motorcycles(shop_id);
create index if not exists idx_sales_shop on sales(shop_id);
create index if not exists idx_sale_items_sale on sale_items(sale_id);
create index if not exists idx_repair_jobs_shop on repair_jobs(shop_id);
create index if not exists idx_repair_job_parts_job on repair_job_parts(job_id);
create index if not exists idx_stock_receipts_part on stock_receipts(part_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — every shop-scoped table is readable/writable only by
-- authenticated members of that shop.
-- ---------------------------------------------------------------------------

alter table shops enable row level security;
alter table app_users enable row level security;
alter table parts enable row level security;
alter table motorcycles enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table repair_jobs enable row level security;
alter table repair_job_parts enable row level security;
alter table stock_receipts enable row level security;

create policy "shop members can read their shop" on shops
  for select using (id = current_shop_id());
create policy "shop members can update their shop" on shops
  for update using (id = current_shop_id());

create policy "shop members can read shop users" on app_users
  for select using (shop_id = current_shop_id());
create policy "admins can manage shop users" on app_users
  for insert with check (shop_id = current_shop_id() and is_admin());
-- Bootstrap case: a brand-new shop has no app_users row yet, so
-- current_shop_id() is null and the policy above can never fire for the
-- very first membership. This lets an authenticated user create exactly one
-- row for themselves, only if they don't already belong to a shop.
create policy "new users can create their own first membership" on app_users
  for insert with check (
    auth_user_id = auth.uid()
    and not exists (select 1 from app_users existing where existing.auth_user_id = auth.uid())
  );
create policy "admins can update shop users" on app_users
  for update using (shop_id = current_shop_id() and is_admin());

create policy "shop members can read parts" on parts
  for select using (shop_id = current_shop_id());
create policy "shop members can write parts" on parts
  for insert with check (shop_id = current_shop_id());
create policy "shop members can update parts" on parts
  for update using (shop_id = current_shop_id());

create policy "shop members can read motorcycles" on motorcycles
  for select using (shop_id = current_shop_id());
create policy "shop members can write motorcycles" on motorcycles
  for insert with check (shop_id = current_shop_id());
create policy "shop members can update motorcycles" on motorcycles
  for update using (shop_id = current_shop_id());

create policy "shop members can read sales" on sales
  for select using (shop_id = current_shop_id());
create policy "shop members can write sales" on sales
  for insert with check (shop_id = current_shop_id());
create policy "shop members can update sales" on sales
  for update using (shop_id = current_shop_id());

create policy "shop members can read sale items" on sale_items
  for select using (sale_id in (select id from sales where shop_id = current_shop_id()));
create policy "shop members can write sale items" on sale_items
  for insert with check (sale_id in (select id from sales where shop_id = current_shop_id()));

create policy "shop members can read repair jobs" on repair_jobs
  for select using (shop_id = current_shop_id());
create policy "shop members can write repair jobs" on repair_jobs
  for insert with check (shop_id = current_shop_id());
create policy "shop members can update repair jobs" on repair_jobs
  for update using (shop_id = current_shop_id());

create policy "shop members can read repair job parts" on repair_job_parts
  for select using (job_id in (select id from repair_jobs where shop_id = current_shop_id()));
create policy "shop members can write repair job parts" on repair_job_parts
  for insert with check (job_id in (select id from repair_jobs where shop_id = current_shop_id()));

create policy "shop members can read stock receipts" on stock_receipts
  for select using (shop_id = current_shop_id());
create policy "shop members can write stock receipts" on stock_receipts
  for insert with check (shop_id = current_shop_id());

-- Shop creation itself has no owning row yet, so it's allowed for any
-- authenticated caller; app_users insert policy above still gates who can
-- actually populate that shop with staff.
create policy "authenticated users can create a shop" on shops
  for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Telemetry — dev-only usage analytics, never surfaced in the shipped app UI.
-- Insert-only for the public key; no select policy at all means the app can
-- never read events back, from its own shop or anyone else's.
-- ---------------------------------------------------------------------------

create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid,
  shop_name text,
  install_id uuid not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  app_version text,
  os text,
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_created on telemetry_events(created_at desc);
create index if not exists idx_telemetry_event_type on telemetry_events(event_type);

alter table telemetry_events enable row level security;

create policy "anyone can insert telemetry" on telemetry_events
  for insert to anon, authenticated with check (true);
-- Deliberately no select/update/delete policy for anon/authenticated —
-- only the Supabase dashboard (service role) can read this table.
