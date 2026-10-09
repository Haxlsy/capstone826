-- The admin-facing Question/Topic field now holds multiple comma-joined
-- phrasings (components/ui/TagInput.tsx) instead of a single question, so
-- the old VARCHAR(255) cap is too tight. TEXT matches what `content` already
-- uses — no inherent length limit at the DB level.
ALTER TABLE chatbot_knowledge ALTER COLUMN topic TYPE TEXT;
