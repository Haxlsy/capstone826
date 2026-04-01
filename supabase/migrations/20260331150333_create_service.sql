create table public.service (
  service_id   serial primary key,
  service_name varchar not null,
  description  text,
  price        decimal(10, 2) not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.service enable row level security;

create policy "service_select_authenticated"
  on public.service for select
  using (auth.role() = 'authenticated');