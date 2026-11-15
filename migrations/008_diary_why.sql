ALTER TABLE techniques ADD COLUMN why text, ADD COLUMN anchors jsonb;
CREATE TABLE diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  summary text NOT NULL,
  heard text,
  feelings text[] NOT NULL DEFAULT '{}',
  themes text[] NOT NULL DEFAULT '{}',
  intensity int,
  quote text,
  transcript text,
  duration_s int
);
CREATE INDEX diary_device_idx ON diary_entries(device_id, created_at DESC)
