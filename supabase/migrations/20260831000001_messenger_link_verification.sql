-- Migration: PSID ownership scoping for the Messenger vehicle-status flow.
--
-- Adds the state needed for the "link my account" fallback: when a Messenger
-- user asks for vehicle status but no customer_record is linked to their psid,
-- the bot asks for plate + booking phone and links the record on a match.
--
--   awaiting_link_verification — the next message is a plate/phone linking attempt
--   link_attempts              — failed verification attempts this conversation
--                                (escalates to Sales at 5)

ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS awaiting_link_verification BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS link_attempts SMALLINT NOT NULL DEFAULT 0;
