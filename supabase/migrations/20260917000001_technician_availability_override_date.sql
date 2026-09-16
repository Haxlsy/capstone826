-- Scopes the manual is_available toggle to a single (Manila) calendar day —
-- see lib/technician-availability.ts, the single source of truth for
-- "is this technician available right now" (weekly schedule, overridden only
-- for the date stamped here; every other day falls back to available_days).
ALTER TABLE technician
  ADD COLUMN IF NOT EXISTS availability_override_date date;
