CREATE TABLE ui_profiles (
  condition text PRIMARY KEY,
  settings jsonb NOT NULL,
  rationale text[] NOT NULL DEFAULT '{}',
  sources jsonb NOT NULL DEFAULT '[]',
  researched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN ui_overrides jsonb NOT NULL DEFAULT '{}';
CREATE TABLE therapy_plans (
  device_id uuid PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  therapist_name text,
  modality text,
  frequency text NOT NULL DEFAULT 'weekly',
  next_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE therapy_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  title text NOT NULL,
  detail text,
  due_on date,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX therapy_hw_idx ON therapy_homework(device_id, created_at DESC);
CREATE TABLE therapy_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  held_at timestamptz NOT NULL,
  attended boolean NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX therapy_sess_idx ON therapy_sessions(device_id, held_at DESC);
ALTER TABLE diary_entries ADD COLUMN risk text NOT NULL DEFAULT 'none', ADD COLUMN risk_note text
