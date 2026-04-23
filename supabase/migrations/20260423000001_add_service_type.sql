-- =================================================================
-- ADD service_type TO service TABLE
-- Categorizes services into predefined types for filtering/display.
-- =================================================================

ALTER TABLE service
  ADD COLUMN service_type TEXT NOT NULL DEFAULT '';

-- Remove the default so future inserts must supply the value explicitly
ALTER TABLE service
  ALTER COLUMN service_type DROP DEFAULT;
