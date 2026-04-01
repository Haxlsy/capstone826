create table public.job_concern (
  concern_id         serial primary key,
  job_order_id       int not null references public.job_order (job_order_id) on delete cascade,
  submitted_by_user_id uuid references public.profile (user_id) on delete set null,
  resolved_by_user_id  uuid references public.profile (user_id) on delete set null,
  concern_type       varchar,
  description        text not null,
  photo_url          text,
  status             public.concern_status not null default 'open',
  admin_note         text,
  resolved_at        timestamptz,
  submitted_at       timestamptz not null default now()
);

create index on public.job_concern (job_order_id);

alter table public.job_concern enable row level security;

create policy "concern_select_authenticated"
  on public.job_concern for select
  using (auth.role() = 'authenticated');