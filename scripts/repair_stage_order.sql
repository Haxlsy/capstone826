-- =====================================================================
-- One-time repair: stage order of ACTIVE job orders.
--
-- Why: before the fix in add-job-order, a stage Operations added in the
-- stage override was saved at the END of the job (e.g. a Preparation
-- "Stage 3" numbered 7, after the Installation and QC stages). Jobs run
-- stages strictly by number, so the head detailer stayed blocked on it.
--
-- What it does: for every Pending / Ongoing / For Rework / Delayed job,
-- renumbers custom_sequence_order so each category's stages are back
-- together (categories in the order they first appear, stages keep their
-- order within a category). Stage status, media and notes are untouched.
--
-- Run in Supabase -> SQL Editor, one section at a time, in order.
-- (Open this file and copy from it; long lines get clipped in chat.)
-- =====================================================================


-- 1) PREVIEW (changes nothing): every stage whose number would change.
WITH s AS (
  SELECT jsp.id,
         jsp.job_order_id,
         jo.job_order_code,
         jsp.status::text                                          AS status,
         coalesce(jsp.custom_name, ss.name)                        AS stage_name,
         coalesce(jsp.custom_sequence_order, ss.sequence_order, 0) AS seq,
         coalesce(ss.category_id, wc.id)                           AS cat
    FROM job_stage_progress jsp
    JOIN job_order jo
      ON jo.id = jsp.job_order_id
     AND jo.status IN ('Pending', 'Ongoing', 'For Rework', 'Delayed')
    LEFT JOIN service_stage ss ON ss.id = jsp.service_stage_id
    LEFT JOIN workflow_category wc
      ON jsp.service_stage_id IS NULL
     AND lower(trim(wc.name)) = lower(trim(jsp.custom_stage_category))
), ranked AS (
  SELECT s.*, min(seq) OVER (PARTITION BY job_order_id, cat) AS cat_first
    FROM s
), target AS (
  SELECT ranked.*,
         row_number() OVER (PARTITION BY job_order_id ORDER BY cat_first, seq, id) AS new_seq
    FROM ranked
)
SELECT job_order_code, stage_name, status, seq AS current_number, new_seq AS new_number
  FROM target
 WHERE job_order_id IN (SELECT job_order_id FROM target WHERE new_seq <> seq)
 ORDER BY job_order_code, new_seq;


-- 2) SKIPPED JOBS (changes nothing): jobs where a not-done stage would
--    move ahead of a stage that is already done (e.g. the installers
--    finished their stages while the misplaced prep stage waited). These
--    are left as they are by step 3; handle them by hand with Operations.
WITH s AS (
  SELECT jsp.id,
         jsp.job_order_id,
         jo.job_order_code,
         jsp.status::text                                          AS status,
         coalesce(jsp.custom_sequence_order, ss.sequence_order, 0) AS seq,
         coalesce(ss.category_id, wc.id)                           AS cat
    FROM job_stage_progress jsp
    JOIN job_order jo
      ON jo.id = jsp.job_order_id
     AND jo.status IN ('Pending', 'Ongoing', 'For Rework', 'Delayed')
    LEFT JOIN service_stage ss ON ss.id = jsp.service_stage_id
    LEFT JOIN workflow_category wc
      ON jsp.service_stage_id IS NULL
     AND lower(trim(wc.name)) = lower(trim(jsp.custom_stage_category))
), ranked AS (
  SELECT s.*, min(seq) OVER (PARTITION BY job_order_id, cat) AS cat_first
    FROM s
), target AS (
  SELECT ranked.*,
         row_number() OVER (PARTITION BY job_order_id ORDER BY cat_first, seq, id) AS new_seq
    FROM ranked
)
SELECT DISTINCT p.job_order_code
  FROM target p
  JOIN target d
    ON d.job_order_id = p.job_order_id
   AND d.status = 'done'
   AND p.status <> 'done'
   AND p.seq > d.seq
   AND p.new_seq < d.new_seq
 ORDER BY p.job_order_code;


-- 3) APPLY: renumber every changed job EXCEPT the ones listed in step 2.
BEGIN;

WITH s AS (
  SELECT jsp.id,
         jsp.job_order_id,
         jsp.status::text                                          AS status,
         coalesce(jsp.custom_sequence_order, ss.sequence_order, 0) AS seq,
         coalesce(ss.category_id, wc.id)                           AS cat
    FROM job_stage_progress jsp
    JOIN job_order jo
      ON jo.id = jsp.job_order_id
     AND jo.status IN ('Pending', 'Ongoing', 'For Rework', 'Delayed')
    LEFT JOIN service_stage ss ON ss.id = jsp.service_stage_id
    LEFT JOIN workflow_category wc
      ON jsp.service_stage_id IS NULL
     AND lower(trim(wc.name)) = lower(trim(jsp.custom_stage_category))
), ranked AS (
  SELECT s.*, min(seq) OVER (PARTITION BY job_order_id, cat) AS cat_first
    FROM s
), target AS (
  SELECT ranked.*,
         row_number() OVER (PARTITION BY job_order_id ORDER BY cat_first, seq, id) AS new_seq
    FROM ranked
), skipped AS (
  SELECT DISTINCT p.job_order_id
    FROM target p
    JOIN target d
      ON d.job_order_id = p.job_order_id
     AND d.status = 'done'
     AND p.status <> 'done'
     AND p.seq > d.seq
     AND p.new_seq < d.new_seq
)
UPDATE job_stage_progress jsp
   SET custom_sequence_order = t.new_seq
  FROM target t
 WHERE jsp.id = t.id
   AND t.new_seq <> t.seq
   AND t.job_order_id NOT IN (SELECT job_order_id FROM skipped);

-- Run section 1 again here: only the step-2 jobs should still show up.
-- If it looks right:   COMMIT;
-- If anything is off:  ROLLBACK;
