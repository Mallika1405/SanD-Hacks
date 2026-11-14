ALTER TABLE alerts ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'alert';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS share_token text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS persisted boolean NOT NULL DEFAULT false;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS visible_after timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS alert_acks (
  id bigserial PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, contact_id, kind)
);
CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'audio',
  trigger text,
  duration_s real,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transcripts (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transcripts_session_idx ON transcripts(session_id, created_at);
CREATE TABLE IF NOT EXISTS descriptions (
  session_id uuid PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  chips jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
