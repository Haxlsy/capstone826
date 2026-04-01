create table public.status_log (
  log_id               serial primary key,
  job_order_id         int not null references public.job_order (job_order_id) on delete cascade,
  changed_by_user_id   uuid references public.profile (user_id) on delete set null,
  old_status           public.job_status,
  new_status           public.job_status not null,
  changed_at           timestamptz not null default now(),
  remarks              text,
  notified_operations  boolean not null default false,
  notified_sales       boolean not null default false
);

create index on public.status_log (job_order_id);

alter table public.status_log enable row level security;

create policy "status_log_select_authenticated"
  on public.status_log for select
  using (auth.role() = 'authenticated');