-- Create technician_team table to manage team assignments for jobs
create table public.technician_team (
  team_id uuid primary key default gen_random_uuid(),
  team_name text not null unique,
  team_lead_id uuid references public.profile (user_id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.technician_team (team_lead_id);
create index on public.technician_team (is_active);

alter table public.technician_team enable row level security;

-- Team members junction table
create table public.team_member (
  team_member_id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.technician_team (team_id) on delete cascade,
  user_id uuid not null references public.profile (user_id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(team_id, user_id)
);

create index on public.team_member (team_id);
create index on public.team_member (user_id);

alter table public.team_member enable row level security;

-- RLS policies: authenticated can read teams/members
create policy "technician_team_select_authenticated"
  on public.technician_team for select
  using (auth.role() = 'authenticated');

create policy "team_member_select_authenticated"
  on public.team_member for select
  using (auth.role() = 'authenticated');
