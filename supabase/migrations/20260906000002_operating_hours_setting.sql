-- =================================================================
-- Structured Operating Hours setting, replacing the free-text "Business
-- hours" knowledge-base entry as the source both the AI chatbot and the
-- "For Release" customer message read (see formatOperatingHours in
-- types/chatbot.ts).
--
-- The seeded values match the shop's actual current hours exactly (Tuesday
-- to Sunday, 8:00 AM to 8:00 PM, closed Mondays + public holidays) so this
-- is a zero-behavior-change migration until an admin edits the new setting
-- — same philosophy as 20260905000004_seed_chatbot_message_templates.sql.
--
-- The old `notify_sales` key is left in place rather than stripped out —
-- chatbotSettingsSchema's `.passthrough()` already ignores unknown keys
-- harmlessly, same as every other deprecated key in this column.
-- =================================================================

UPDATE chatbot_config
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'operating_days',               to_jsonb(ARRAY['tue','wed','thu','fri','sat','sun']),
  'operating_open_time',          '08:00',
  'operating_close_time',         '20:00',
  'operating_closed_on_holidays', true
);

-- Superseded by the setting above — its content (including the instructional
-- sentence admin didn't want customers/admins to keep seeing) no longer
-- reflects how hours are sourced.
DELETE FROM chatbot_knowledge
WHERE category = 'Hours' AND topic = 'Business hours';
