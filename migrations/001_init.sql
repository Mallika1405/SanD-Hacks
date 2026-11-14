CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  opted_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'walk' CHECK (mode IN ('walk','ride','party','emergency')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  destination jsonb,
  expected_route jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id, status);

CREATE TABLE IF NOT EXISTS location_points (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  geom geography(Point,4326) NOT NULL,
  accuracy real,
  speed real,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS location_points_session_idx ON location_points(session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS location_points_geom_idx ON location_points USING gist(geom);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  owner_secret text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','claimed','cancelled')),
  reason text,
  place_text text,
  geom geography(Point,4326),
  claimed_by uuid REFERENCES contacts(id),
  claimed_at timestamptz,
  retried_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '6 hours'
);

CREATE TABLE IF NOT EXISTS alert_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  attempt int NOT NULL DEFAULT 1,
  call_sid text,
  status text NOT NULL DEFAULT 'queued',
  digit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, contact_id, attempt)
);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  note text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_alert_idx ON events(alert_id, created_at);
CREATE INDEX IF NOT EXISTS events_session_idx ON events(session_id, created_at);

CREATE TABLE IF NOT EXISTS places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text UNIQUE,
  name text NOT NULL,
  category text,
  address text,
  website text,
  geom geography(Point,4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS places_geom_idx ON places USING gist(geom);

CREATE TABLE IF NOT EXISTS place_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  source_url text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  hours_text text,
  open_24h boolean NOT NULL DEFAULT false,
  staffed boolean,
  confidence real NOT NULL DEFAULT 0.5,
  uncertain boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS place_facts_place_idx ON place_facts(place_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id bigserial PRIMARY KEY,
  cell text NOT NULL,
  geom geography(Point,4326) NOT NULL,
  kind text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS incidents_geom_idx ON incidents USING gist(geom);

CREATE TABLE IF NOT EXISTS webhook_events (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
