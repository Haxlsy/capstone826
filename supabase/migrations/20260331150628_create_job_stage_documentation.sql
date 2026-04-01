create table public.job_stage_documentation (
  document_id       serial primary key,
  job_order_id      int not null references public.job_order (job_order_id) on delete cascade,
  stage_template_id int not null references public.service_stage_template (stage_template_id) on delete restrict,
  submitted_by_user_id uuid references public.profile (user_id) on delete set null,
  stage_status      public.stage_status not null default 'pending',
  media_url         text,
  media_type        public.media_type,
  submitted_at      timestamptz,
  rework_note       text,
  local_uuid        uuid unique
);

create index on public.job_stage_documentation (job_order_id);
create index on public.job_stage_documentation (stage_template_id);

alter table public.job_stage_documentation enable row level security;

create policy "stage_doc_select_authenticated"
  on public.job_stage_documentation for select
  using (auth.role() = 'authenticated');