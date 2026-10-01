-- =================================================================
-- Popular Service chart: move the count from "fetch every matching
-- job_order row and group in JS" to the database.
--
-- Mirrors lib/admin/service-breakdown.ts's serviceBreakdownLabel rule
-- (service_type, falling back to the service name) so the SQL and the
-- JS stay in step — see tests/service-breakdown.test.ts for the rule
-- itself. job_order.service_id is NOT NULL, so a plain JOIN is safe.
--
-- Only ever called via the admin (service-role) client from server
-- code (lib/admin/dashboard-data.ts, app/api/admin/dashboard/
-- service-breakdown/route.ts) — no GRANT to anon/authenticated.
--
-- job_order.status is the `job_status` enum, not text, so it's cast
-- before comparing against the text[] array the JS side passes in.
-- =================================================================

CREATE OR REPLACE FUNCTION public.service_breakdown_counts(
  p_statuses text[],
  p_since    timestamptz DEFAULT NULL
)
RETURNS TABLE(service_name text, count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(trim(s.service_type), ''), s.name, 'Unknown') AS service_name,
         count(*) AS count
    FROM job_order jo
    JOIN service s ON s.id = jo.service_id
   WHERE jo.is_archived = false
     AND jo.status::text = ANY(p_statuses)
     AND (p_since IS NULL OR jo.created_at >= p_since)
   GROUP BY 1
   ORDER BY count DESC;
$$;
