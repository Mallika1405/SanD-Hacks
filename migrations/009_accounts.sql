CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  salt text NOT NULL,
  device_id uuid UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles (
  device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  display_name text,
  conditions text[] NOT NULL DEFAULT '{}',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tracker_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  kind text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracker_idx ON tracker_logs(device_id, kind, created_at DESC);
CREATE TABLE soundscapes (
  key text PRIMARY KEY,
  prompt text NOT NULL,
  audio bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)
