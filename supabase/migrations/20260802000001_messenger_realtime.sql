-- =================================================================
-- Messenger realtime publication + indexes
-- Enables live chat updates on the Sales Messenger page
-- (new customer messages / escalated conversations appear instantly).
-- =================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_conversation;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_message;

-- Conversation lookup by PSID (webhook get-or-create)
CREATE INDEX IF NOT EXISTS idx_messenger_conversation_psid
  ON public.messenger_conversation (psid);

-- Sales messenger listing (escalated first)
CREATE INDEX IF NOT EXISTS idx_messenger_conversation_status_last_msg
  ON public.messenger_conversation (status, last_message_at DESC);

-- Message thread reads for a conversation
CREATE INDEX IF NOT EXISTS idx_messenger_message_conversation_sent
  ON public.messenger_message (conversation_id, sent_at);
