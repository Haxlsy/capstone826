-- =================================================================
-- Dynamic Workflow Categories
-- Replaces the hardcoded service_stage_category ENUM with a
-- workflow_category table, enabling admins to add/remove category
-- sections inline when defining services.
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Create workflow_category table
-- -----------------------------------------------------------------

CREATE TABLE workflow_category (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  technician_role TEXT        NOT NULL CHECK (technician_role IN ('detailer', 'installer')),
  display_color   TEXT        NOT NULL DEFAULT 'blue',
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------
-- 2. Seed the three existing categories (preserves all current data)
-- -----------------------------------------------------------------

INSERT INTO workflow_category (name, technician_role, display_color) VALUES
  ('preparation',  'detailer',  'blue'),
  ('installation', 'installer', 'purple'),
  ('finishing',    'detailer',  'emerald');

-- -----------------------------------------------------------------
-- 3. Add category_id column to service_stage (nullable first)
-- -----------------------------------------------------------------

ALTER TABLE service_stage
  ADD COLUMN category_id UUID REFERENCES workflow_category(id);

-- -----------------------------------------------------------------
-- 4. Backfill category_id from existing ENUM values
-- -----------------------------------------------------------------

UPDATE service_stage ss
SET    category_id = wc.id
FROM   workflow_category wc
WHERE  wc.name = ss.category::TEXT;

-- -----------------------------------------------------------------
-- 5. Now enforce NOT NULL
-- -----------------------------------------------------------------

ALTER TABLE service_stage
  ALTER COLUMN category_id SET NOT NULL;

-- -----------------------------------------------------------------
-- 6. Drop the old ENUM column and type
-- -----------------------------------------------------------------

ALTER TABLE service_stage DROP COLUMN category;

DROP TYPE IF EXISTS service_stage_category CASCADE;

-- -----------------------------------------------------------------
-- 7. RLS on workflow_category
-- -----------------------------------------------------------------

ALTER TABLE workflow_category ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (needed for service forms, job views)
CREATE POLICY "workflow_category_select"
  ON workflow_category FOR SELECT
  TO authenticated
  USING (true);

-- Only admins / super_admins can insert
CREATE POLICY "workflow_category_insert"
  ON workflow_category FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_account
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Only admins / super_admins can update
CREATE POLICY "workflow_category_update"
  ON workflow_category FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_account
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
