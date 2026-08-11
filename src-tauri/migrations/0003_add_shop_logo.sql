-- Adds a shop logo, shown in the sidebar and on printed receipts/invoices.
-- Stored as a data: URL (resized client-side before upload). Local-only
-- for now, same as the shop name edit — neither pushes to the cloud today.
ALTER TABLE shops ADD COLUMN logo TEXT;
