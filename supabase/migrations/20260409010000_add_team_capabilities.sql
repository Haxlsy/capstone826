-- Track which services each team is qualified to perform
create table public.team_capability (
  team_capability_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.technician_team (team_id) on delete cascade,
  service_id int not null references public.service (service_id) on delete cascade,
  completed_jobs int not null default 0,
  is_certified boolean not null default false,
  certified_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(team_id, service_id)
);

create index on public.team_capability (team_id);
create index on public.team_capability (service_id);
create index on public.team_capability (is_certified);

alter table public.team_capability enable row level security;

create policy "team_capability_select_authenticated"
  on public.team_capability for select
  using (auth.role() = 'authenticated');

-- Track team member availability (vacation, sick leave, etc.)
create type public.availability_status as enum ('available', 'vacation', 'sick', 'training', 'unavailable');

create table public.team_member_availability (
  availability_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profile (user_id) on delete cascade,
  team_id uuid not null references public.technician_team (team_id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status public.availability_status not null default 'unavailable',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create index on public.team_member_availability (user_id);
create index on public.team_member_availability (team_id);
create index on public.team_member_availability (start_date);
create index on public.team_member_availability (end_date);

alter table public.team_member_availability enable row level security;

create policy "team_member_availability_select_authenticated"
  on public.team_member_availability for select
  using (auth.role() = 'authenticated');

-- Job complexity levels for matching
create type public.job_complexity as enum ('simple', 'standard', 'complex', 'specialized');

-- Add complexity level to job_order if not exists
alter table public.job_order
  add column if not exists complexity_level public.job_complexity not null default 'standard';

-- Team location and coverage area for geographic optimization
alter table public.technician_team
  add column if not exists location_district text,
  add column if not exists max_daily_capacity int,
  add column if not exists is_specialized boolean default false;

comment on column public.technician_team.location_district is 'Geographic area team covers (North, Central, South)';
comment on column public.technician_team.max_daily_capacity is 'Maximum jobs team can handle per day';
comment on column public.technician_team.is_specialized is 'Handles complex and specialty work';

create index on public.technician_team (location_district);
