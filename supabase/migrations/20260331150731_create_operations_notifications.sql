create table public.operations_notification (
  notif_id          serial primary key,
  job_order_id      int references public.job_order (job_order_id) on delete cascade,
  status_log_id     int references public.status_log (log_id) on delete set null,
  sent_to_user_id   uuid references public.profile (user_id) on delete set null,
  notification_type public.notification_type not null,
  message           text,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index on public.operations_notification (sent_to_user_id);
create index on public.operations_notification (job_order_id);

alter table public.operations_notification enable row level security;

create policy "notification_select_own"
  on public.operations_notification for select
  using (auth.uid() = sent_to_user_id);