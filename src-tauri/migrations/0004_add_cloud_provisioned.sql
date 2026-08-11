-- Tracks whether each staff account has a cloud login yet. Needed because
-- provisioning a staff member requires their plaintext password (to set
-- their Supabase account password), which is never stored locally — only
-- the hash. So instead of a stored password, we retry provisioning the
-- next time that specific person types their password to sign in, and use
-- this flag to know who still needs it.
ALTER TABLE app_users ADD COLUMN cloud_provisioned_at TEXT;
