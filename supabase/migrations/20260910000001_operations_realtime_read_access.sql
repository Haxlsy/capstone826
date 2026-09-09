-- =================================================================
-- Grants `operations` the same realtime read access `20260905000002` gave
-- sales/admin/super_admin on job_order, concern, and concern_media.
--
-- Without this, every Operations-side `useRealtimeRefetch("job_order", ...)`
-- or `("concern", ...)` subscription — including "Recent Job Orders" and the
-- Job Concerns page — silently receives zero events for an operations-role
-- user: Realtime evaluates RLS as the subscribing browser user, and the
-- existing SELECT policies on these tables only cover sales/admin/
-- super_admin. Service-role API routes are unaffected either way (RLS is
-- bypassed there already); this only changes what a browser session can
-- read directly for realtime delivery.
--
-- Idempotent: safe to run more than once.
-- =================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_order', 'concern', 'concern_media']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "sales_admin_read_%s" ON %I', t, t);
    EXECUTE format($f$
      CREATE POLICY "sales_admin_read_%s"
        ON %I FOR SELECT
        TO authenticated
        USING (public.current_staff_role() IN ('sales', 'admin', 'super_admin', 'operations'))
    $f$, t, t);
  END LOOP;
END $$;
