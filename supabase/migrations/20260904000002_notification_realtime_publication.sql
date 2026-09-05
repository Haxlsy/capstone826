-- Ensure the `notification` table is replicated over Supabase Realtime.
-- hooks/useNotifications.ts subscribes to postgres_changes INSERT events on
-- this table; without it being part of the supabase_realtime publication the
-- subscription silently receives nothing and the UI only updates on refresh.
--
-- ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS guard, so this is
-- wrapped in a DO block to stay safely re-runnable if the table was already
-- added manually via the Supabase dashboard (Database → Replication).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notification;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'notification already in supabase_realtime publication, skipping.';
END $$;
