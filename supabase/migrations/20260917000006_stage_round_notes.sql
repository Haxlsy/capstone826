-- Per-round completion notes for rework. job_stage_progress.completion_notes
-- stays exactly what it's always meant (round 0's note) — every rework round
-- (round 1+) gets its own row here instead, so Operations can see what the
-- head technician did/changed on each rework attempt, keeping full history
-- the same way stage_media.rework_round already does for photos/video.
CREATE TABLE IF NOT EXISTS stage_round_note (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_stage_progress_id  UUID        NOT NULL REFERENCES job_stage_progress(id) ON DELETE CASCADE,
  round                  INT         NOT NULL,
  notes                  TEXT        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_id          UUID        REFERENCES user_account(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_round_note_stage ON stage_round_note(job_stage_progress_id);

ALTER TABLE stage_round_note ENABLE ROW LEVEL SECURITY;
