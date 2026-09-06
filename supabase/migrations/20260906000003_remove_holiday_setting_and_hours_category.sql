-- =================================================================
-- Removes two now-unsupported chatbot-config concepts:
--
-- 1. The "Also closed on public holidays" Operating Hours toggle
--    (`operating_closed_on_holidays`) — there is no way for the app to know
--    when a given day actually falls on a public holiday, so unconditionally
--    claiming the shop is closed for one was frequently just wrong. The
--    schema (chatbotSettingsSchema in types/chatbot.ts) no longer defines
--    this key; `.passthrough()` would otherwise leave it sitting unused in
--    the stored jsonb forever, so it's stripped here for tidiness.
--
-- 2. The "Hours" knowledge-base category — operating hours already moved to
--    the structured setting above in 20260906000002_operating_hours_setting.sql
--    (which deleted the old free-text "Business hours" KB entry). Any
--    leftover admin-created "Hours" entries are reassigned to "Other" rather
--    than deleted, since their content may still be useful, before the
--    column's CHECK constraint is tightened to no longer allow the value.
-- =================================================================

UPDATE chatbot_config
SET settings = settings - 'operating_closed_on_holidays'
WHERE settings ? 'operating_closed_on_holidays';

UPDATE chatbot_knowledge
SET category = 'Other'
WHERE category = 'Hours';

ALTER TABLE chatbot_knowledge
  DROP CONSTRAINT IF EXISTS chatbot_knowledge_category_check;

ALTER TABLE chatbot_knowledge
  ADD CONSTRAINT chatbot_knowledge_category_check
  CHECK (category IN ('Service', 'Pricing', 'FAQ', 'Other'));
