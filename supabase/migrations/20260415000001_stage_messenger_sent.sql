-- ================================================================
-- Track whether the AI/messenger auto-update was sent per stage.
--   NULL  = not yet attempted (stage not done yet, or send not triggered)
--   TRUE  = successfully sent to customer via Messenger
--   FALSE = send was attempted but failed
-- ================================================================

ALTER TABLE job_stage_progress
  ADD COLUMN IF NOT EXISTS messenger_sent    BOOLEAN,
  ADD COLUMN IF NOT EXISTS messenger_sent_at TIMESTAMPTZ;
