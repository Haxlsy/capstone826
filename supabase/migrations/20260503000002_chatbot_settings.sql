ALTER TABLE chatbot_config
  ADD COLUMN IF NOT EXISTS settings JSONB;
