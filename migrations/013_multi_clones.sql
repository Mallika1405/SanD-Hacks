CREATE TABLE IF NOT EXISTS cloned_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  voice_id text NOT NULL,
  name text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, voice_id)
);
INSERT INTO cloned_voices(device_id, voice_id, name, consent_at)
  SELECT device_id, clone_voice_id, COALESCE(clone_name, 'My'), COALESCE(clone_consent_at, now()) FROM preferences WHERE clone_voice_id IS NOT NULL
  ON CONFLICT DO NOTHING
