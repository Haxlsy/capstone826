-- Single active session per account — see docs/plan (session enforcement).
--
-- A logged-in user's browser carries an opaque session_token cookie
-- (826_session_token). Each login overwrites this table's row for that
-- user_id with a freshly generated token; proxy.ts compares the cookie
-- against this row on every page load and signs out any browser holding a
-- stale token — i.e. whichever browser was NOT the most recent login.
--
-- Writes go through the service-role login/logout API routes exactly like
-- every other table in this app, so RLS here only needs to cover the read
-- path — a signed-in user may see their own row, nothing else. Mirrors
-- push_subscription's exact pattern (supabase/migrations/20260905000005_push_subscription.sql).

CREATE TABLE IF NOT EXISTS user_active_session (
  user_id       UUID        PRIMARY KEY REFERENCES user_account(id) ON DELETE CASCADE,
  session_token TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_active_session ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_active_session" ON user_active_session;
CREATE POLICY "own_active_session"
  ON user_active_session FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
