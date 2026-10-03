-- job_order_history.reason was already being written to (and read from) by
-- app/api/operations/job-orders/[id]/route.ts and lib/operations/job-detail-data.ts,
-- but the column never actually existed — both the insert (whenever a reason
-- was provided) and the select were silently failing, since neither call
-- site checks that particular query's error. The insert failure meant a
-- reason typed in by staff was silently dropped; the select failure made the
-- entire Status History render as empty, since a failed query and "no rows"
-- are indistinguishable once the error itself is discarded.
ALTER TABLE job_order_history ADD COLUMN IF NOT EXISTS reason TEXT;
