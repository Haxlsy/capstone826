-- =================================================================
-- Removes the "ask before reporting" flow's columns, added in
-- 20260906000005_messenger_report_confirmation.sql.
--
-- Superseded by a simpler design: a complaint now escalates immediately
-- (filed as a Report) exactly like a threat/policy violation does, rather
-- than asking the customer to confirm first — both are treated as real
-- concerns that shouldn't wait. See the "violation" classification handling
-- in app/api/webhook/facebook/route.ts.
-- =================================================================

ALTER TABLE messenger_conversation
  DROP COLUMN IF EXISTS awaiting_report_confirmation;

ALTER TABLE messenger_conversation
  DROP COLUMN IF EXISTS pending_report_text;
