-- Adds a profile picture to staff accounts. Stored as a data: URL (the
-- image is resized client-side before upload, so this stays small) — local
-- only for now, not yet part of the cloud sync engine.
ALTER TABLE app_users ADD COLUMN avatar TEXT;
