-- Add team assignment and duration tracking to job_order
alter table public.job_order
  add column if not exists assigned_team_id uuid references public.technician_team (team_id) on delete set null,
  add column if not exists duration_hours int;

create index on public.job_order (assigned_team_id);
