ALTER TABLE preferences ADD COLUMN IF NOT EXISTS companion_voice_id text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS diary_voice_id text;
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS soothing boolean NOT NULL DEFAULT false
