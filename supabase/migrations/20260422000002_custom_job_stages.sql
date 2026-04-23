-- =================================================================
-- CUSTOM JOB STAGES
-- Allows operations to add stages to a specific job order that are
-- not part of the original service template. These rows have
-- service_stage_id = NULL and are identified by custom_stage_category.
-- =================================================================

-- Make service_stage_id nullable so custom stages have no FK reference
ALTER TABLE job_stage_progress
  ALTER COLUMN service_stage_id DROP NOT NULL;

-- The old UNIQUE constraint assumed service_stage_id is never null.
-- Replace with a partial unique index that only applies to seeded rows.
ALTER TABLE job_stage_progress
  DROP CONSTRAINT IF EXISTS job_stage_progress_job_order_id_service_stage_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_stage_unique_seeded
  ON job_stage_progress(job_order_id, service_stage_id)
  WHERE service_stage_id IS NOT NULL;

-- Category for custom-only stages (seeded stages derive category via join on service_stage)
ALTER TABLE job_stage_progress
  ADD COLUMN IF NOT EXISTS custom_stage_category service_stage_category;
