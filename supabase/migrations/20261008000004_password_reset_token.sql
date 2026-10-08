-- Self-service "forgot password" tokens. Only a SHA-256 hash of the raw
-- token is ever stored — the raw value exists only in the emailed link,
-- same principle as password_hash being the only form a password takes.
-- At most one unused token per account at a time (requesting a new one
-- invalidates any prior unused token for that user) — a simple, adequate
-- guard against stacking up live tokens, no separate rate-limiter needed.
CREATE TABLE password_reset_token (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_token_user_id_idx ON password_reset_token (user_id);
