-- Publishes chatbot_knowledge for Realtime so Admin's AI Configuration
-- knowledge base list updates live when another admin adds/edits/removes an
-- entry. No RLS policy needed — chatbot_knowledge does not have row level
-- security enabled, so publishing alone is sufficient.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chatbot_knowledge;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'chatbot_knowledge is already in supabase_realtime, skipping.';
  END;
END $$;
