create table public.offline_sync_queue (
  queue_id            serial primary key,
  user_id             uuid references public.profile (user_id) on delete set null,
  local_uuid          uuid not null,
  entity_type         public.entity_type not null,
  operation           public.operation_type not null,
  payload             json not null,
  sync_status         public.sync_status not null default 'pending',
  conflict_data       json,
  created_offline_at  timestamptz not null,
  synced_at           timestamptz,
  retry_count         int not null default 0
);

create table public.sync_conflict_log (
  conflict_id         serial primary key,
  queue_id            int references public.offline_sync_queue (queue_id) on delete set null,
  resolved_by_user_id uuid references public.profile (user_id) on delete set null,
  local_uuid          uuid not null,
  entity_type         public.entity_type not null,
  local_payload       json not null,
  server_payload      json not null,
  resolution          public.resolution_type,
  detected_at         timestamptz not null default now(),
  resolved_at         timestamptz
);

create index on public.offline_sync_queue (user_id);
create index on public.offline_sync_queue (sync_status);
create index on public.sync_conflict_log (queue_id);

alter table public.offline_sync_queue enable row level security;
alter table public.sync_conflict_log enable row level security;

create policy "sync_queue_select_own"
  on public.offline_sync_queue for select
  using (auth.uid() = user_id);

create policy "conflict_log_select_authenticated"
  on public.sync_conflict_log for select
  using (auth.role() = 'authenticated');