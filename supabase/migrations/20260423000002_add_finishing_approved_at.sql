-- Track when the head_detailer passes finishing stages to operations.
-- Operations' "For Released" button is enabled only after this is set.
ALTER TABLE job_order
  ADD COLUMN IF NOT EXISTS finishing_approved_at TIMESTAMPTZ DEFAULT NULL;
