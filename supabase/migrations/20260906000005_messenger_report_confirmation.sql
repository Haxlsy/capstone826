-- =================================================================
-- messenger_conversation.awaiting_report_confirmation / pending_report_text
--
-- Backs the "ask before reporting" flow: a message the AI flags as a
-- complaint (escalation_reason: "complaint" — see generateChatbotReply in
-- lib/messenger/chatbot.ts) is no longer escalated immediately. The bot asks
-- the customer to confirm first, and only escalates — filed as a Report, not
-- a generic Human Response — once they do.
--
--   awaiting_report_confirmation — the next message is the customer's
--                                  yes/no answer to that question
--   pending_report_text          — the original complaint text, used as the
--                                  eventual inquiry's last_message instead of
--                                  whatever short "yes"/"opo" confirms it
-- =================================================================

ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS awaiting_report_confirmation BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS pending_report_text TEXT;
