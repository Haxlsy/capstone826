-- Removes the Temporary Head Technician feature
-- (added by 20261107000001_temporary_head_access.sql).
--
-- The team decided it is not needed: a head technician shortage is the
-- client's manpower issue, and the existing "Add substitute" flow already
-- covers absences.
--
-- Run this in Supabase BEFORE deploying the code that removes the feature.
-- The code still running today reads these columns defensively, so dropping
-- them first is safe. Safe to run more than once.
--
-- Kept on purpose:
--   * audit_log rows about temporary heads (audit history is not rewritten)
--   * job_order_team rows (a past job still shows who substituted)

-- 1. Archive every temporary head login FIRST. Once the expiry check is gone
--    from the code, these logins would otherwise work as normal head accounts
--    forever. Archived accounts are already blocked at login, on every page
--    and on every API call.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_account'
      AND column_name  = 'is_temporary_head'
  ) THEN
    UPDATE user_account
       SET is_archived = true
     WHERE is_temporary_head = true
       AND is_archived = false;
  END IF;
END $$;

-- 2. Drop the columns the feature added.
ALTER TABLE technician
  DROP COLUMN IF EXISTS user_account_id;

ALTER TABLE user_account
  DROP COLUMN IF EXISTS access_expires_at,
  DROP COLUMN IF EXISTS is_temporary_head;
