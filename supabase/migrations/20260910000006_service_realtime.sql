-- Publishes service for Realtime so Admin's Service Management table
-- (components/AdminSide/ServiceManagement/ServiceTable.tsx) updates live
-- when another admin adds/edits/archives a service. No RLS policy needed —
-- `service` does not have row level security enabled at all (unlike
-- user_account/audit_log), so publishing alone is sufficient.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE service;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'service is already in supabase_realtime, skipping.';
  END;
END $$;
