-- Flags an account as needing a mandatory password change before it can be
-- used normally — set true on account creation and on an admin-triggered
-- password reset, cleared once the user successfully changes their password.
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
