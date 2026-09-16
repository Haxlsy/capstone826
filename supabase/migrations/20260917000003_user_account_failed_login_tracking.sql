-- Server-side tracking for failed login attempts, so the 3-attempts/60s
-- lockout can be enforced and logged authoritatively instead of relying on
-- the client's own (trivially bypassable) counter. See app/api/auth/login/route.ts.
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS failed_login_count SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_login_at    TIMESTAMPTZ  NULL;
