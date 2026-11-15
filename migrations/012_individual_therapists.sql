ALTER TABLE providers ADD COLUMN IF NOT EXISTS credentials text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS is_individual boolean NOT NULL DEFAULT false;
UPDATE providers SET is_individual = true WHERE kind = 'therapist' AND name ~ '^(Dr\.? )?[A-Z][a-z]+ ([A-Z]\.? )?[A-Z][a-zA-Z''-]+(,|$| [A-Z]{2,})'
