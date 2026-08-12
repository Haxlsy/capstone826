-- =================================================================
-- CHATBOT_KNOWLEDGE category column
-- Adds the admin-facing category used for colour-coded badges in the
-- Knowledge Base tab (Service / Pricing / Hours / FAQ / Other).
-- =================================================================

ALTER TABLE chatbot_knowledge
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'FAQ';

-- Keep the stored value constrained to the client/API categories.
ALTER TABLE chatbot_knowledge
  ADD CONSTRAINT chatbot_knowledge_category_check
  CHECK (category IN ('Service', 'Pricing', 'Hours', 'FAQ', 'Other'));