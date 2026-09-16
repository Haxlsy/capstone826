-- job_order was sorted by created_at (lib/operations/dashboard-data.ts) with
-- no supporting index — status/scheduled_at/is_archived/FKs are indexed,
-- created_at wasn't, so that sort got slower as the table grew.
CREATE INDEX IF NOT EXISTS idx_job_order_created_at ON job_order(created_at);
