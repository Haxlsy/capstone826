-- Temporary Head Technician: when no head technician is available, Operations
-- can make a technician who is present the head for ONE job, for ONE day
-- (app/api/operations/job-orders/[id]/temporary-head/route.ts).
--
-- The login is created once per technician and reused; its access switches off
-- on its own at the end of the day (access_expires_at), so no admin has to
-- create or archive an account for every absence. Expired access is blocked in
-- the same places as an archived account (login, every page, every API call).
-- Only adds nullable / defaulted columns: safe to run on live data.

ALTER TABLE user_account
  -- When set and in the past, the account can no longer sign in or act.
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ NULL,
  -- Marks logins created for a Temporary Head Technician (shown in Admin).
  ADD COLUMN IF NOT EXISTS is_temporary_head BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE technician
  -- The technician's Temporary Head login, so it is created once and reused.
  ADD COLUMN IF NOT EXISTS user_account_id UUID NULL UNIQUE
    REFERENCES user_account(id) ON DELETE SET NULL;
