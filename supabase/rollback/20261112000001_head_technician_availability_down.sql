-- ROLLBACK for supabase/migrations/20261112000001_head_technician_availability.sql
--
-- The team decided not to ship head technician availability: the existing
-- "Add substitute head technician" flow already covers an absent head. The
-- feature's code is kept on a separate branch to return to later.
--
-- Run ONCE in the Supabase SQL Editor. Safe to re-run (IF EXISTS).
-- Lives in supabase/rollback/ (not migrations/) so no migration run ever drops
-- these columns again on the branch that keeps the feature; to bring the
-- feature back, run the original migration again.
--
-- Only loses the head schedules / toggles set while testing. Crew availability
-- lives on the `technician` table and is untouched.
--
-- If this branch's code is still deployed, it keeps working without these
-- columns (lib/operations/head-accounts.ts falls back on error 42703): every
-- head counts as available every day, so no head warnings appear.

ALTER TABLE user_account
  DROP COLUMN IF EXISTS available_days,
  DROP COLUMN IF EXISTS work_start_time,
  DROP COLUMN IF EXISTS work_end_time,
  DROP COLUMN IF EXISTS is_available,
  DROP COLUMN IF EXISTS availability_override_date;
