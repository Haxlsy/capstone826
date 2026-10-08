-- A pending second-factor challenge, created once the username/password have
-- already been verified (see app/api/auth/login/route.ts) and resolved by
-- app/api/auth/verify-mfa/route.ts. Two methods share one table so the
-- verify endpoint's shape stays uniform:
--   'email' — code_hash is a SHA-256 hash of a 6-digit code we emailed;
--             verified entirely in our own code.
--   'totp'  — factor_id is the user's enrolled Supabase MFA factor; the
--             actual code check is delegated to Supabase's own
--             auth.mfa.challenge/verify, not stored here at all.
-- At most one unused challenge per account at a time — creating a new one
-- invalidates any prior unused challenge for that user, same principle as
-- password_reset_token.
CREATE TABLE login_mfa_challenge (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method        TEXT        NOT NULL CHECK (method IN ('email', 'totp')),
  code_hash     TEXT,
  factor_id     TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  attempt_count SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_mfa_challenge_user_id_idx ON login_mfa_challenge (user_id);
