-- Chatbot behavior fixes — graduated escalation for repeated off-topic / policy
-- violations. Two counters on the conversation track consecutive violation turns
-- (identified per-turn by the model's `violation` classification). Off-topic
-- escalates to Sales after 5 consecutive turns (warned on turn 4); safety/policy
-- violations escalate after 2 (warned on turn 1). Both counters reset to 0 on the
-- next valid on-topic message and whenever the conversation is escalated.
--
-- Everything else in this change set derives its cross-turn memory from the
-- conversation history (which the same change set fixes to return the most recent
-- messages), so no further columns are needed.

ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS offtopic_streak smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS policy_streak   smallint NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
