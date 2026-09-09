-- =================================================================
-- Adds 'For Inspection' to the job_status enum.
--
-- app/api/head-technician/jobs/[id]/route.ts already writes this value to
-- job_order.status when the last stage of a "For Rework" job is marked
-- done (quality-check re-inspection after rework), and the rest of the app
-- (StatusPickerModal, Operations dashboard status counts/summary cards,
-- delay-status allow-lists) already treats it as a real, expected status —
-- but the enum itself never actually gained this value, so that write was
-- failing outright against the database. This migration is the fix.
-- =================================================================

ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'For Inspection' AFTER 'For Rework';
