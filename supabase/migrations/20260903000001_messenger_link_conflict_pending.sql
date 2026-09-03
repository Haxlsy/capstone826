-- Migration: one neutral warning before flagging a suspected impersonation.
--
-- When a Messenger user tries to link a plate that is already linked to a
-- DIFFERENT psid, the bot no longer escalates on the spot. It first replies with
-- the same neutral "I couldn't verify those details" message shown when a plate
-- is not found at all, so the reply itself never reveals that the plate belongs
-- to someone else. Only a SECOND such claim is escalated to Sales as a possible
-- impersonation.
--
--   link_conflict_pending — the customer has already been given that neutral
--                           warning for a record owned by another account; the
--                           next conflicting claim escalates.
--
-- Mirrors `conflict_pending`, which plays the same "already surfaced once" role
-- for booking identity conflicts.

ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS link_conflict_pending BOOLEAN NOT NULL DEFAULT false;
