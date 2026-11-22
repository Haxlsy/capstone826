-- Data retention, part 1: the columns and tables the retention job needs
-- (docs/task/panel-recommendations.md, Phase 3). Nothing is deleted here;
-- the daily job that deletes comes later (Phase 5) and starts in dry-run.
--
-- What this adds:
--   1. job_order.released_at   when a job became a Job Record (its clock)
--   2. archived_at             on user_account, technician, service (their clock)
--   3. shop_config.retention_months / retention_changed_at   the Admin's setting
--   4. retention_notice        which records the weekly digest already announced
--   5. indexes on the timestamps the retention job filters by
--
-- released_at and archived_at are kept up to date by triggers, so every code
-- path that releases a job or archives something is covered without changing
-- the app, including ones added later.
--
-- Safe to re-run. Rollback: supabase/rollback/20261122000001_data_retention_down.sql

BEGIN;

-- ── 1. job_order.released_at ────────────────────────────────────────────────
ALTER TABLE job_order ADD COLUMN IF NOT EXISTS released_at timestamptz;

-- Existing released jobs: the latest 'Released' entry in their history ...
UPDATE job_order jo
   SET released_at = h.last_released
  FROM (
    SELECT job_order_id, max(created_at) AS last_released
      FROM job_order_history
     WHERE status = 'Released'
     GROUP BY job_order_id
  ) h
 WHERE jo.id = h.job_order_id
   AND jo.status = 'Released'
   AND jo.released_at IS NULL;

-- ... or, with no history entry, the last time the job changed.
UPDATE job_order
   SET released_at = coalesce(updated_at, created_at)
 WHERE status = 'Released'
   AND released_at IS NULL;

-- From now on: set when a job becomes Released, cleared if it ever leaves.
CREATE OR REPLACE FUNCTION public.set_job_order_released_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'Released' THEN
    NEW.released_at := NULL;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'Released' THEN
    NEW.released_at := coalesce(OLD.released_at, NEW.released_at, now());  -- already released: keep the date
  ELSE
    NEW.released_at := coalesce(NEW.released_at, now());                   -- just released
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_job_order_released_at ON job_order;
CREATE TRIGGER trg_job_order_released_at
  BEFORE INSERT OR UPDATE OF status ON job_order
  FOR EACH ROW EXECUTE FUNCTION public.set_job_order_released_at();

-- ── 2. archived_at on accounts, technicians, services ───────────────────────
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE technician   ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE service      ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Items archived before today have no known archive date: they start their
-- clock now, so nothing is deleted the moment retention goes live.
UPDATE user_account SET archived_at = now() WHERE is_archived AND archived_at IS NULL;
UPDATE technician   SET archived_at = now() WHERE is_archived AND archived_at IS NULL;
UPDATE service      SET archived_at = now() WHERE is_archived AND archived_at IS NULL;

-- Archiving starts the clock; restoring clears it (so a restored item is
-- never deleted, and archiving again starts a fresh clock).
CREATE OR REPLACE FUNCTION public.set_archived_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_archived THEN
    NEW.archived_at := NULL;                                               -- restored
  ELSIF TG_OP = 'UPDATE' AND OLD.is_archived THEN
    NEW.archived_at := coalesce(OLD.archived_at, NEW.archived_at, now());  -- still archived: keep the date
  ELSE
    NEW.archived_at := coalesce(NEW.archived_at, now());                   -- just archived
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_account_archived_at ON user_account;
CREATE TRIGGER trg_user_account_archived_at
  BEFORE INSERT OR UPDATE OF is_archived ON user_account
  FOR EACH ROW EXECUTE FUNCTION public.set_archived_at();

DROP TRIGGER IF EXISTS trg_technician_archived_at ON technician;
CREATE TRIGGER trg_technician_archived_at
  BEFORE INSERT OR UPDATE OF is_archived ON technician
  FOR EACH ROW EXECUTE FUNCTION public.set_archived_at();

DROP TRIGGER IF EXISTS trg_service_archived_at ON service;
CREATE TRIGGER trg_service_archived_at
  BEFORE INSERT OR UPDATE OF is_archived ON service
  FOR EACH ROW EXECUTE FUNCTION public.set_archived_at();

-- ── 3. The Admin's retention setting ────────────────────────────────────────
-- Fixed choices only (also enforced in the app: lib/retention/config.ts).
-- retention_changed_at drives the 14-day safety rule: nothing becomes due
-- sooner than 14 days after the period changes. Setting it to now() here
-- means data that is ALREADY older than 6 months gets 14 days' notice
-- (and a weekly digest) instead of being deleted on the first run.
ALTER TABLE shop_config ADD COLUMN IF NOT EXISTS retention_months int NOT NULL DEFAULT 6;
ALTER TABLE shop_config ADD COLUMN IF NOT EXISTS retention_changed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE shop_config DROP CONSTRAINT IF EXISTS shop_config_retention_months_check;
ALTER TABLE shop_config ADD CONSTRAINT shop_config_retention_months_check
  CHECK (retention_months IN (3, 6, 12, 24));

-- ── 4. retention_notice: digest de-duplication ──────────────────────────────
-- One row per record the weekly digest has announced for a given deletion
-- date, so the same record is never announced twice. Deliberately NO foreign
-- key: these rows must survive the deletion of the record they describe
-- (a cascade would wipe them, as it does job_delay_alert). record_id is text
-- because messenger_conversation uses a bigint id; the others are uuids.
-- Only the service role reads or writes it.
CREATE TABLE IF NOT EXISTS retention_notice (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type  text NOT NULL CHECK (record_type IN (
                 'job_record', 'customer', 'inquiry', 'conversation',
                 'audit_log', 'notification', 'user_account', 'technician', 'service'
               )),
  record_id    text NOT NULL,
  delete_on    date NOT NULL,
  notified_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT retention_notice_unique UNIQUE (record_type, record_id, delete_on)
);

ALTER TABLE retention_notice ENABLE ROW LEVEL SECURITY;

-- ── 5. Indexes for the retention job's date filters ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_job_order_released_at
  ON job_order (released_at) WHERE released_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_account_archived_at
  ON user_account (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_technician_archived_at
  ON technician (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_archived_at
  ON service (archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inquiry_resolved_at
  ON inquiry (resolved_at) WHERE resolved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messenger_conversation_last_message_at
  ON messenger_conversation (last_message_at);
CREATE INDEX IF NOT EXISTS idx_notification_created_at
  ON notification (created_at);
CREATE INDEX IF NOT EXISTS idx_customer_updated_at
  ON customer (updated_at);
CREATE INDEX IF NOT EXISTS idx_retention_notice_notified_at
  ON retention_notice (notified_at);
-- audit_log.created_at is already indexed (20260415000002_audit_log.sql).

COMMIT;
