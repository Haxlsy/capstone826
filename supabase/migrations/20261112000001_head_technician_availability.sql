-- Head technician availability, so Operations can mark a head technician
-- absent from the Technician module and every job order that needs them shows
-- "assign a substitute" (lib/operations/head-coverage.ts).
--
-- Same columns and meaning as the crew's on `technician`, so both are judged by
-- one rule (isAvailableOn in lib/technician-availability.ts):
--   available_days             weekly working days
--   work_start/end_time        shown in the module (not used for the warning)
--   is_available +
--   availability_override_date the manual toggle, which only counts on the day
--                              it was set; every other day follows the weekly
--                              schedule, so it resets on its own at midnight.
--
-- Only heads use these. Other roles get the harmless defaults. Every existing
-- head starts out available every day, so nothing warns until Operations sets
-- a schedule or toggles someone off. Safe to run on live data and to re-run.

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS available_days  TEXT[]  NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  ADD COLUMN IF NOT EXISTS work_start_time TIME    NOT NULL DEFAULT '08:00:00',
  ADD COLUMN IF NOT EXISTS work_end_time   TIME    NOT NULL DEFAULT '20:00:00',
  ADD COLUMN IF NOT EXISTS is_available    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS availability_override_date DATE;
