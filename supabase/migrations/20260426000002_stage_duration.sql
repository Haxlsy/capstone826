-- =================================================================
-- Stage Duration
-- Adds stage_duration_mins to service_stage so duration is owned
-- per-stage. service.estimated_duration_mins becomes a derived sum.
-- Existing rows default to 0 (admins fill in via Edit Service).
-- =================================================================

ALTER TABLE service_stage
  ADD COLUMN stage_duration_mins INT NOT NULL DEFAULT 0;
