-- Rework media as a separate, operations-only round — never sent to the
-- linked customer. See app/api/operations/job-orders/[id]/stage-rework/route.ts
-- and app/api/head-technician/jobs/[id]/stages/[stageId]/media/route.ts.

-- Which round is currently active for this stage. 0 = initial (pre-rework,
-- customer-facing). Operations bumps this each time it flags the stage for
-- rework again, so multiple rework rounds keep their own history.
ALTER TABLE job_stage_progress
  ADD COLUMN IF NOT EXISTS current_rework_round INT NOT NULL DEFAULT 0;

-- Which round this specific photo/video belongs to. Round 0 is the original,
-- customer-facing upload; round 1+ are rework resubmissions — operations-only,
-- never sent to the linked customer.
ALTER TABLE stage_media
  ADD COLUMN IF NOT EXISTS rework_round INT NOT NULL DEFAULT 0;
