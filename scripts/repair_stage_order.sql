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
-- HOW TO RUN (Supabase -> SQL Editor). Select ONE section's statement,
-- then press Run. Each section is a single statement.
--   1. Section 0 (optional): check one job order. Change the code first.
--   2. Section 1: preview what will change. Changes nothing.
--   3. Section 2: jobs that will be skipped. Changes nothing.
--   4. Section 3: apply. It saves immediately and lists every stage it
--      renumbered. An empty result means nothing needed changing.
--   5. Run section 1 again: only the section-2 jobs should be left.
-- (Open this file and copy from it; long lines get clipped in chat.)
-- =====================================================================


-- 0) DIAGNOSE ONE JOB (changes nothing). Replace JO-CODE-HERE with the
--    job order code shown in Operations, then run. Shows each stage's
--    category and the number it would get, and why a job might not move.
WITH s AS (
  SELECT jsp.id,
         jsp.job_order_id,
         jo.job_order_code,
         jo.status                                                 AS job_status,
         jsp.status::text                                          AS status,
         coalesce(jsp.custom_name, ss.name)                        AS stage_name,
         jsp.custom_stage_category,
         coalesce(jsp.custom_sequence_order, ss.sequence_order, 0) AS seq,
         coalesce(ss.category_id, wc.id)                           AS cat,
         coalesce(tc.name, wc.name)                                AS category_name
    FROM job_stage_progress jsp
    JOIN job_order jo ON jo.id = jsp.job_order_id
    LEFT JOIN service_stage ss ON ss.id = jsp.service_stage_id
    LEFT JOIN workflow_category tc ON tc.id = ss.category_id
    LEFT JOIN workflow_category wc
      ON jsp.service_stage_id IS NULL
     AND lower(trim(wc.name)) = lower(trim(jsp.custom_stage_category))
   WHERE jo.job_order_code = 'JO-CODE-HERE'
), ranked AS (
  SELECT s.*, min(seq) OVER (PARTITION BY job_order_id, cat) AS cat_first
    FROM s
), target AS (
  SELECT ranked.*,
         row_number() OVER (PARTITION BY job_order_id ORDER BY cat_first, seq, id) AS new_seq
    FROM ranked
)
SELECT job_order_code,
       job_status,
       job_status IN ('Pending', 'Ongoing', 'For Rework', 'Delayed') AS repaired_by_script,
       stage_name,
       status,
       category_name,
       custom_stage_category,
       seq     AS current_number,
       new_seq AS new_number,
       EXISTS (
         SELECT 1 FROM target d
          WHERE d.status = 'done' AND target.status <> 'done'
            AND target.seq > d.seq AND target.new_seq < d.new_seq
       ) AS would_skip_job
  FROM target
 ORDER BY new_seq;


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
--    One statement: it saves as soon as it finishes (no BEGIN / COMMIT
--    needed) and lists each stage it renumbered.
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
   AND t.job_order_id NOT IN (SELECT job_order_id FROM skipped)
RETURNING t.job_order_code, t.stage_name, t.seq AS old_number, t.new_seq AS new_number;
