-- Split user_account.full_name into first_name/last_name so the Add/Edit
-- Account form (Admin Accounts + Internal Staff Accounts) can collect and
-- store normalized name data. full_name stays as a plain, NOT NULL column
-- recomputed by application code at its two write paths
-- (app/api/admin/create-account/route.ts and app/api/admin/update-account/route.ts)
-- — see those routes for details.
ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Best-effort backfill: split existing full_name values on the first space.
-- Heuristic only — for multi-token names ("Maria Dela Cruz") everything
-- after the first token lands in last_name ("Dela Cruz"). Existing rows can
-- be corrected manually afterward via Edit Account.
UPDATE user_account
SET
  first_name = split_part(trim(full_name), ' ', 1),
  last_name  = NULLIF(
                 trim(substring(trim(full_name) FROM length(split_part(trim(full_name), ' ', 1)) + 1)),
                 ''
               )
WHERE first_name IS NULL;
