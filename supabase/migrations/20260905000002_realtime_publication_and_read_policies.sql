-- Makes Supabase Realtime actually work for the staff screens that already
-- subscribe to it.
--
-- The client subscriptions have existed for a while (InquiryManagement.tsx and
-- hooks/useRealtimeRefetch.ts, used by four Admin dashboard components) but have
-- never received a single event, because two database-side prerequisites were
-- missing:
--
--   1. The tables are not in the `supabase_realtime` publication, so Postgres
--      never streams their changes at all.
--   2. The tables have RLS enabled with NO policies. Realtime evaluates RLS as
--      the subscribing user, and "RLS on, no policies" denies everything to the
--      `authenticated` role — so even a published table delivers nothing.
--
-- Nobody noticed (2) because every read in the app goes through a service-role
-- API route, which bypasses RLS entirely. These policies are SELECT-only and
-- exist purely so Realtime can deliver change events to the right staff; all
-- writes continue to go through the service-role routes and are unaffected.
--
-- Idempotent: safe to run more than once.

-- =================================================================
-- 1. Publication membership
-- =================================================================
-- `notification` was added by 20260904000002 and is already applied; the rest
-- are added here. Each is wrapped so a table already present is skipped rather
-- than aborting the migration.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inquiry',            -- Sales: Inquiry Management (escalations)
    'concern',            -- Sales: Concerns
    'concern_media',      -- Sales: Concerns (attachments added after the fact)
    'job_order',          -- Sales job list + Admin dashboard cards/charts
    'job_stage_progress', -- Sales job list: stage completion moves the status
    'customer_record',    -- Sales: Customer Records
    'shop_config',        -- Admin dashboard: capacity card
    'technician',         -- Admin dashboard: technician availability
    'job_order_team'      -- Admin dashboard: technician assignment
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE '% is already in supabase_realtime, skipping.', t;
    END;
  END LOOP;
END $$;

-- =================================================================
-- 2. Role lookup helper
-- =================================================================
-- SECURITY DEFINER is required, not a shortcut: `user_account` also has RLS
-- enabled with no policies, so a plain `EXISTS (SELECT 1 FROM user_account ...)`
-- inside a policy would be filtered to zero rows and the policy would always
-- evaluate false. Running as the function owner bypasses that lookup problem
-- without opening up `user_account` itself.

CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_account
  WHERE id = auth.uid()
    AND is_archived = false
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_staff_role() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

COMMENT ON FUNCTION public.current_staff_role() IS
  'Returns the calling user''s staff role, bypassing RLS on user_account so it can be used inside policies.';

-- =================================================================
-- 3. SELECT policies for Sales + Admin
-- =================================================================
-- Scoped deliberately: these tables carry customer PII (names, phone numbers,
-- emails, plate numbers), so technicians and detailers must not be able to read
-- them directly with the browser publishable key. Service role still bypasses
-- all of this.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inquiry', 'concern', 'concern_media', 'job_order', 'customer_record']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "sales_admin_read_%s" ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY "sales_admin_read_%s"
        ON %I FOR SELECT
        TO authenticated
        USING (public.current_staff_role() IN ('sales', 'admin', 'super_admin'))
    $f$, t, t);
  END LOOP;
END $$;

-- Admin dashboard tables: no customer PII, so any signed-in staff member may
-- read them (the dashboard cards are visible to admins only in the UI anyway).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['shop_config', 'technician', 'job_order_team', 'job_stage_progress']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff_read_%s" ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY "staff_read_%s"
        ON %I FOR SELECT
        TO authenticated
        USING (public.current_staff_role() IS NOT NULL)
    $f$, t, t);
  END LOOP;
END $$;

-- Verify what ended up live:
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
