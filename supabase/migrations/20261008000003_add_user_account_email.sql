-- Real, deliverable contact email per account — separate from the synthetic
-- `username@826autocare.internal` address used purely as the Supabase Auth
-- sign-in identity (see app/api/admin/create-account/route.ts). This column
-- is what the new account-creation email, forgot-password, and MFA-email
-- features actually send mail to; it never touches auth.users.email.
--
-- Nullable at the DB level since every existing account has none yet —
-- required going forward by application-level validation on create/edit.
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Case-insensitive uniqueness, same approach as the normalized unique
-- indexes already added for service/service_type/category_preset names
-- (LOWER(...) functional index) — needed because forgot-password resolves
-- an email to exactly one account.
CREATE UNIQUE INDEX IF NOT EXISTS user_account_email_normalized_uq
  ON user_account (LOWER(email))
  WHERE email IS NOT NULL;
