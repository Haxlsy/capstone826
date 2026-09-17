-- 20260422000002_custom_job_stages.sql defined job_stage_progress.custom_stage_category
-- using the service_stage_category ENUM — but 20260426000001_dynamic_workflow_categories.sql
-- (four days later) replaced that whole enum-based category system with the
-- workflow_category table, and drops the enum type with CASCADE. Postgres
-- drops any column that depends on a dropped type via CASCADE, so no matter
-- what order these two migrations run in, custom_stage_category never
-- actually survives on a database that also has dynamic_workflow_categories
-- applied — which is every current deployment, since workflow_category is
-- used everywhere. The application (lib/operations/job-detail-data.ts,
-- app/api/operations/job-management/add-job-order/route.ts,
-- components/dashboard/OperationComponents/ServiceOverridePanel.tsx) has
-- only ever treated this as free text matched against workflow_category.name
-- — never as a fixed enum — so this recreates it as TEXT instead of trying
-- to resurrect the now-defunct enum type.
ALTER TABLE job_stage_progress
  ALTER COLUMN service_stage_id DROP NOT NULL;

ALTER TABLE job_stage_progress
  DROP CONSTRAINT IF EXISTS job_stage_progress_job_order_id_service_stage_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_stage_unique_seeded
  ON job_stage_progress(job_order_id, service_stage_id)
  WHERE service_stage_id IS NOT NULL;

ALTER TABLE job_stage_progress
  ADD COLUMN IF NOT EXISTS custom_stage_category TEXT;
