ALTER TABLE alert_calls ADD COLUMN IF NOT EXISTS control_url text;
ALTER TABLE alert_calls ADD COLUMN IF NOT EXISTS provider text
