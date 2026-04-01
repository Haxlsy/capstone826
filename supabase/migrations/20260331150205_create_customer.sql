create table public.customer (
  customer_id    serial primary key,
  full_name      varchar not null,
  contact_number varchar not null,
  email          varchar,
  home_address   text,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.customer enable row level security;

create policy "customer_select_authenticated"
  on public.customer for select
  using (auth.role() = 'authenticated');