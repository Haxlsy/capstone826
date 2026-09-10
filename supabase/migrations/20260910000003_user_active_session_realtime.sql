-- Publishes user_active_session for Realtime so a stale browser can be told
-- the instant a newer login happens elsewhere, instead of only being caught
-- on its next page navigation (proxy.ts). RLS is already correct for this —
-- the existing own_active_session policy (user_id = auth.uid()) from
-- 20260910000002_user_active_session.sql — same "RLS already covers Realtime
-- delivery" pattern as every other realtime table in this app (see
-- 20260905000002_realtime_publication_and_read_policies.sql).

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_active_session;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'user_active_session is already in supabase_realtime, skipping.';
  END;
END $$;
