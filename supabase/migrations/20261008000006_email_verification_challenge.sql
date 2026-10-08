-- Self-service "connect my email for MFA" challenges (Settings → Add/Update
-- Email). Mirrors login_mfa_challenge's shape but scoped to a CANDIDATE
-- email that isn't written to user_account yet — it's only saved once the
-- code sent here is confirmed, so an unverified/abandoned attempt never
-- touches the account's real email.
CREATE TABLE email_verification_challenge (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  code_hash     TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  attempt_count SMALLINT    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_challenge_user_id_idx ON email_verification_challenge (user_id);
