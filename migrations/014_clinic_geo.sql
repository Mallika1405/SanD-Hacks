ALTER TABLE providers ADD COLUMN IF NOT EXISTS clinic text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS geo_tried boolean NOT NULL DEFAULT false
