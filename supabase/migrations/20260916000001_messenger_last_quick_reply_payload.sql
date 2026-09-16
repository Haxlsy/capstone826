-- Remembers the payload of the last predefined quick-reply button the
-- customer tapped, so a rapid repeat tap of the SAME button can be
-- suppressed instead of re-running the full reply pipeline for each press.
-- See app/api/webhook/facebook/route.ts.
ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS last_quick_reply_payload text;
