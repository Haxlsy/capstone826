-- Lets an "inquiry" notification (Sales, from a Messenger escalation) deep-link
-- straight to the specific inquiry instead of just the general Sales page.
-- See app/api/webhook/facebook/route.ts and lib/notify-role.ts.
ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS inquiry_id UUID REFERENCES inquiry(id) ON DELETE SET NULL;
