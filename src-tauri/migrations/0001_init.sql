-- MotoStock local database schema (SQLite, offline source of truth).
-- Every syncable table carries updated_at + dirty + deleted_at so the sync
-- engine can push local changes and soft-delete rows across devices.

CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Engine', 'Brakes', 'Electrical', 'Accessories')),
  stock INTEGER NOT NULL DEFAULT 0,
  min_threshold INTEGER NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS motorcycles (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  model_name TEXT NOT NULL,
  vin TEXT NOT NULL,
  displacement TEXT,
  category TEXT NOT NULL CHECK (category IN ('Sport', 'Scooter', 'Naked', 'Off-Road')),
  price REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

-- POS counter sales (retail parts sales, outgoing stock path #1)
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  user_id TEXT REFERENCES app_users(id),
  customer_name TEXT,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

-- Line items snapshot part name/number/price at time of sale so receipts
-- stay correct even if the part is later renamed, repriced, or deleted.
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

-- Repair jobs (outgoing stock path #2: parts consumed against a job)
CREATE TABLE IF NOT EXISTS repair_jobs (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  user_id TEXT REFERENCES app_users(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  motorcycle_desc TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'completed')) DEFAULT 'open',
  labor_fee REAL NOT NULL DEFAULT 0,
  notes TEXT,
  total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS repair_job_parts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES repair_jobs(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL
);

-- Ingoing stock (receiving parts from a supplier) — the other half of
-- "ingoing and outgoing of parts purchases", kept as its own audit trail
-- rather than silent edits to parts.stock.
CREATE TABLE IF NOT EXISTS stock_receipts (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  part_id TEXT NOT NULL REFERENCES parts(id),
  user_id TEXT REFERENCES app_users(id),
  qty INTEGER NOT NULL,
  unit_cost REAL NOT NULL DEFAULT 0,
  supplier TEXT,
  reference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1
);

-- Sync engine cursor bookkeeping (one row per syncable table).
CREATE TABLE IF NOT EXISTS sync_meta (
  table_name TEXT PRIMARY KEY,
  last_synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_app_users_shop ON app_users(shop_id);
CREATE INDEX IF NOT EXISTS idx_parts_shop ON parts(shop_id);
CREATE INDEX IF NOT EXISTS idx_motorcycles_shop ON motorcycles(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_shop ON repair_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_repair_job_parts_job ON repair_job_parts(job_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_part ON stock_receipts(part_id);
