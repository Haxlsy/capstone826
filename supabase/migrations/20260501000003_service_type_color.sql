ALTER TABLE service_type
  ADD COLUMN IF NOT EXISTS display_color TEXT NOT NULL DEFAULT 'blue';
