-- Grants head_detailer/head_installer the same realtime read access on
-- job_order that sales/admin/super_admin/operations already have
-- (20260905000002_realtime_publication_and_read_policies.sql,
-- 20260910000001_operations_realtime_read_access.sql).
--
-- Without this, hooks/use-technician-jobs.ts's
-- useRealtimeRefetch(["job_order", "job_stage_progress", "job_order_team"], ...)
-- silently receives zero `job_order` events for a technician's browser —
-- Realtime evaluates RLS as the subscribing user, and job_order's existing
-- SELECT policy doesn't cover these two roles. job_order_team/
-- job_stage_progress already have a broad "any staff role" policy, which is
-- why stage-level realtime (e.g. Job Detail) already worked; job_order
-- itself was the one gap — confirmed by symptom: creating a job order
-- didn't refresh a technician's job list until manual reload.
--
-- Not new data exposure: technicians already see full job_order fields
-- (customer name, plate, etc.) for their assigned jobs today through the
-- existing service-role API routes (lib/head-technician/jobs-data.ts);
-- this only widens what their own browser session can read directly for
-- Realtime delivery.
--
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS "sales_admin_read_job_order" ON job_order;
CREATE POLICY "sales_admin_read_job_order"
  ON job_order FOR SELECT
  TO authenticated
  USING (public.current_staff_role() IN ('sales', 'admin', 'super_admin', 'operations', 'head_detailer', 'head_installer'));
