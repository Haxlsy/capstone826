-- Publishes user_account for Realtime so Admin's Account Management table
-- (components/AdminSide/AccountManagement/AccountTable.tsx) updates live
-- when another admin creates/edits/archives an account.
--
-- user_account has RLS enabled with NO existing SELECT policy (see the
-- "Role lookup helper" note in 20260905000002_realtime_publication_and_read_
-- policies.sql), so a plain publish alone would deliver zero events — this
-- adds an admin/super_admin-only SELECT policy using the same
-- public.current_staff_role() helper already established there, scoped
-- tightly since this table carries usernames and roles for every account.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_account;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'user_account is already in supabase_realtime, skipping.';
  END;
END $$;

DROP POLICY IF EXISTS "admin_read_user_account" ON user_account;
CREATE POLICY "admin_read_user_account"
  ON user_account FOR SELECT
  TO authenticated
  USING (public.current_staff_role() IN ('admin', 'super_admin'));
