DROP TABLE IF EXISTS webhook_events, alert_acks, alert_calls, alerts, clips, transcripts, descriptions, events, incidents, location_points, place_facts, places, sessions, contacts, users CASCADE;
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE preferences (
  device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  voice_id text,
  voice_kind text NOT NULL DEFAULT 'preset',
  voice_name text,
  voice_consent_at timestamptz,
  prefers jsonb NOT NULL DEFAULT '{}',
  hard_times text,
  checkins_opt_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  flow text NOT NULL DEFAULT 'unsure',
  state text NOT NULL DEFAULT 'start',
  ctx jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  helpful_exercise_ids text[] NOT NULL DEFAULT '{}',
  summary text
);
CREATE INDEX sessions_device_idx ON sessions(device_id, started_at DESC);
CREATE TABLE checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  done_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'therapist',
  specialties text[] NOT NULL DEFAULT '{}',
  modalities text[] NOT NULL DEFAULT '{}',
  location text,
  telehealth boolean,
  url text,
  insurance_text text,
  cost_text text,
  availability_text text,
  source_url text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false,
  confidence real NOT NULL DEFAULT 0.4,
  UNIQUE (source_url, name)
);
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'support_group',
  topics text[] NOT NULL DEFAULT '{}',
  format text,
  schedule_text text,
  cost_text text,
  url text,
  source_url text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false,
  confidence real NOT NULL DEFAULT 0.4,
  UNIQUE (source_url, name)
);
CREATE TABLE provider_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
