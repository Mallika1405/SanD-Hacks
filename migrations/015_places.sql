ALTER TABLE providers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rating real;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rating_count int;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS place_id text
