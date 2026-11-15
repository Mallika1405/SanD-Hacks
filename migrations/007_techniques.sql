CREATE TABLE techniques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_key text NOT NULL,
  flow text NOT NULL,
  title text NOT NULL,
  steps jsonb NOT NULL,
  duration_s int,
  source_url text NOT NULL,
  source_name text NOT NULL,
  quote text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  reviewed boolean NOT NULL DEFAULT false,
  UNIQUE (situation_key, source_url, title)
);
CREATE INDEX techniques_key_idx ON techniques(situation_key, checked_at DESC);
ALTER TABLE sessions ADD COLUMN research_key text, ADD COLUMN research text
