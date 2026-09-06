-- job_order never got an updated_at column/trigger, unlike most other tables
-- (user_account, technician, chatbot_knowledge, etc. — see
-- 20260412000002_rebuild_schema.sql). Needed so the Operations dashboard's
-- "Recent Job Orders" widget can sort by last-touched instead of created_at,
-- so a job that just had a stage completed, a rework flag, a reassignment,
-- etc. resurfaces there even if it was created long ago.

ALTER TABLE job_order ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_job_order_updated_at ON job_order;
CREATE TRIGGER trg_job_order_updated_at
  BEFORE UPDATE ON job_order
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
