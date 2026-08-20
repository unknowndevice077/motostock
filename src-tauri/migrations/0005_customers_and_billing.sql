-- Real customer identity (previously customer_name was independent free
-- text duplicated on sales and repair_jobs, with no link between them),
-- plus the pieces needed to bill a repair job's parts + labor as one POS
-- receipt: repair_jobs.sale_id links a completed job to the sale it
-- produced, and sale_items.part_id becomes nullable so a "Labor" line can
-- exist without a real part behind it.

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shop_id);

ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE repair_jobs ADD COLUMN customer_id TEXT REFERENCES customers(id);
ALTER TABLE repair_jobs ADD COLUMN sale_id TEXT REFERENCES sales(id);

CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_customer ON repair_jobs(customer_id);

-- SQLite can't drop a NOT NULL constraint in place — rebuild the table.
CREATE TABLE sale_items_new (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES sales(id),
  part_id TEXT REFERENCES parts(id),
  part_name TEXT NOT NULL,
  part_number TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price REAL NOT NULL
);
INSERT INTO sale_items_new (id, sale_id, part_id, part_name, part_number, qty, unit_price)
  SELECT id, sale_id, part_id, part_name, part_number, qty, unit_price FROM sale_items;
DROP TABLE sale_items;
ALTER TABLE sale_items_new RENAME TO sale_items;
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
