create table public.job_order (
  job_order_id          serial primary key,
  customer_id           int not null references public.customer (customer_id) on delete restrict,
  service_id            int not null references public.service (service_id) on delete restrict,
  vehicle_type_id       int not null references public.vehicle_type (vehicle_type_id) on delete restrict,
  assigned_technician_id uuid references public.profile (user_id) on delete set null,
  created_by_user_id    uuid not null references public.profile (user_id) on delete restrict,
  operations_user_id    uuid references public.profile (user_id) on delete set null,
  sales_user_id         uuid references public.profile (user_id) on delete set null,
  plate_number          varchar,
  car_make              varchar,
  car_model             varchar,
  car_color             varchar,
  payment_amount        decimal(10, 2) not null default 0,
  payment_status        public.payment_status not null default 'unpaid',
  scheduled_start       date,
  scheduled_end         date,
  current_status        public.job_status not null default 'pending',
  local_uuid            uuid unique,
  sync_status           public.sync_status not null default 'synced',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on public.job_order (customer_id);
create index on public.job_order (assigned_technician_id);
create index on public.job_order (created_by_user_id);
create index on public.job_order (operations_user_id);
create index on public.job_order (sales_user_id);
create index on public.job_order (current_status);

alter table public.job_order enable row level security;

create policy "job_order_select_authenticated"
  on public.job_order for select
  using (auth.role() = 'authenticated');