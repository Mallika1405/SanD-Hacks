CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  session_id uuid UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'talk',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  transcript jsonb NOT NULL DEFAULT '[]',
  summary text
);
CREATE INDEX IF NOT EXISTS conversations_device_idx ON conversations(device_id, started_at DESC);
CREATE TABLE IF NOT EXISTS playbooks (
  condition text PRIMARY KEY,
  content jsonb NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]',
  researched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE preferences ADD COLUMN IF NOT EXISTS save_conversations boolean NOT NULL DEFAULT true
