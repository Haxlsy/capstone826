create table public.vehicle_type (
  vehicle_type_id serial primary key,
  type_name       varchar not null unique,
  description     text,
  is_active       boolean not null default true
);

alter table public.vehicle_type enable row level security;

create policy "vehicle_type_select_authenticated"
  on public.vehicle_type for select
  using (auth.role() = 'authenticated');