-- =================================================================
-- SERVICE OVERRIDE COLUMNS
-- Adds per-job override fields to job_order and job_stage_progress.
-- These store edits made in the Service Override Panel when creating
-- a job order. The original service / stage rows are never modified.
-- =================================================================

ALTER TABLE job_order
  ADD COLUMN IF NOT EXISTS custom_service_name  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_description   TEXT,
  ADD COLUMN IF NOT EXISTS custom_duration_mins INT;

ALTER TABLE job_stage_progress
  ADD COLUMN IF NOT EXISTS custom_name           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custom_sequence_order INT;
