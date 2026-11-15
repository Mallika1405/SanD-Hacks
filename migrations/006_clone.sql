ALTER TABLE preferences ADD COLUMN IF NOT EXISTS clone_voice_id text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS clone_name text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS clone_consent_at timestamptz
