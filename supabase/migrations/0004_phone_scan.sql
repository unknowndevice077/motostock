-- Phone-as-scanner: pair a phone to a shop by QR code (no login on the
-- phone), then every part-label QR it scans shows up on the laptop live.
--
-- The phone never gets a Supabase session — phone_sessions is created and
-- revoked directly by the (already-authenticated) laptop, but scan_events
-- is written ONLY by the scan-relay Edge Function using the service role,
-- after it validates the pairing token itself. That's why scan_events has
-- no insert/update policy for anon/authenticated at all, mirroring how
-- telemetry_events locks writes to service-role-only — the token, not RLS,
-- is what gates who can add a scan.

create table if not exists phone_sessions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  created_by uuid references app_users(id),
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz
);

create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  phone_session_id uuid references phone_sessions(id) on delete set null,
  part_id uuid references parts(id),
  part_name text not null,
  part_number text not null,
  stock integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_sessions_shop on phone_sessions(shop_id);
create index if not exists idx_scan_events_shop on scan_events(shop_id, created_at desc);

alter table phone_sessions enable row level security;
alter table scan_events enable row level security;

-- The laptop (authenticated shop member) creates and revokes pairing
-- sessions directly — no Edge Function needed for pairing itself.
create policy "shop members can read phone sessions" on phone_sessions
  for select using (shop_id = current_shop_id());
create policy "shop members can create phone sessions" on phone_sessions
  for insert with check (shop_id = current_shop_id());
create policy "shop members can update phone sessions" on phone_sessions
  for update using (shop_id = current_shop_id());

-- Read-only for shop members; deliberately no insert/update policy here —
-- only scan-relay's service-role client ever writes a scan event.
create policy "shop members can read scan events" on scan_events
  for select using (shop_id = current_shop_id());

alter publication supabase_realtime add table scan_events;
