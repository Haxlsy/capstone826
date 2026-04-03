-- Add estimated_duration_days to service table.
-- This column is required by the AddServiceModal UI field "Estimated Service Duration".
alter table public.service
  add column if not exists estimated_duration_days int;
