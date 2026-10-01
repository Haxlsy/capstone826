-- One-time backfill: service.estimated_duration_mins had drifted out of sync
-- with the sum of its service_stage rows for any service where a stage
-- removal was previously blocked (still referenced by an active job's
-- progress) but had already been dropped from the saved total. The app code
-- now recomputes this from service_stage after every edit instead of trusting
-- the submitted stage list — this backfill corrects rows already affected.
UPDATE service s
SET estimated_duration_mins = sub.total
FROM (
  SELECT service_id, COALESCE(SUM(stage_duration_mins), 0) AS total
  FROM service_stage
  GROUP BY service_id
) sub
WHERE s.id = sub.service_id
  AND s.estimated_duration_mins IS DISTINCT FROM sub.total;
