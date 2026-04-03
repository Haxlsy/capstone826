create table public.customer_intake (
  intake_id      serial primary key,
  customer_id    int not null references public.customer(customer_id),
  plate_number   varchar,
  make           varchar,
  model          varchar,
  color          varchar,
  service_id     int references public.service(service_id),
  downpayment    numeric(10,2) not null default 0,
  balance        numeric(10,2) not null default 0,
  payment_method varchar,
  scheduled_date date,
  status         varchar not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.customer_intake enable row level security;

create policy "customer_intake_select_authenticated"
  on public.customer_intake for select
  using (auth.role() = 'authenticated');
