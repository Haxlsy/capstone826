-- Undoes supabase/migrations/20261122000001_data_retention.sql.
-- Removes the retention columns, triggers, the setting and retention_notice.
-- No other data is touched. Run the retention job's removal first (Phase 5)
-- if it has been deployed, or it will fail on the missing columns.

BEGIN;

DROP TRIGGER IF EXISTS trg_job_order_released_at    ON job_order;
DROP TRIGGER IF EXISTS trg_user_account_archived_at ON user_account;
DROP TRIGGER IF EXISTS trg_technician_archived_at   ON technician;
DROP TRIGGER IF EXISTS trg_service_archived_at      ON service;

DROP FUNCTION IF EXISTS public.set_job_order_released_at();
DROP FUNCTION IF EXISTS public.set_archived_at();

DROP INDEX IF EXISTS idx_job_order_released_at;
DROP INDEX IF EXISTS idx_user_account_archived_at;
DROP INDEX IF EXISTS idx_technician_archived_at;
DROP INDEX IF EXISTS idx_service_archived_at;
DROP INDEX IF EXISTS idx_inquiry_resolved_at;
DROP INDEX IF EXISTS idx_messenger_conversation_last_message_at;
DROP INDEX IF EXISTS idx_notification_created_at;
DROP INDEX IF EXISTS idx_customer_updated_at;

DROP TABLE IF EXISTS retention_notice;

ALTER TABLE shop_config DROP CONSTRAINT IF EXISTS shop_config_retention_months_check;
ALTER TABLE shop_config DROP COLUMN IF EXISTS retention_changed_at;
ALTER TABLE shop_config DROP COLUMN IF EXISTS retention_months;

ALTER TABLE job_order    DROP COLUMN IF EXISTS released_at;
ALTER TABLE user_account DROP COLUMN IF EXISTS archived_at;
ALTER TABLE technician   DROP COLUMN IF EXISTS archived_at;
ALTER TABLE service      DROP COLUMN IF EXISTS archived_at;

COMMIT;
