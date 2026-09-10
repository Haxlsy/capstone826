-- Publishes audit_log for Realtime so the Admin Security Center's audit log
-- (hooks/use-audit-logs.ts) updates live instead of only on navigation/manual
-- reload. RLS is already correct for this — the existing "Admins can read
-- audit log" policy (20260415000002_audit_log.sql) already restricts reads
-- to admin/super_admin, which is exactly who this should deliver events to.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'audit_log is already in supabase_realtime, skipping.';
  END;
END $$;
