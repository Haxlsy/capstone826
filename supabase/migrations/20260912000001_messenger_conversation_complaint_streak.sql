-- Consecutive-"complaint"-classification counter, mirroring offtopic_streak /
-- policy_streak (see 20260910... conversation-flags migration). Lets a first
-- "complaint" classification get one clarifying reply instead of an instant
-- full escalation — see app/api/webhook/facebook/route.ts.
ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS complaint_streak smallint NOT NULL DEFAULT 0;
