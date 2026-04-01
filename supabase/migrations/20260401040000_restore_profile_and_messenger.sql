-- restore dropped types
create type public.user_role as enum (
  'admin', 'head_technician', 'technician', 'operations', 'sales'
);

create type public.handler_role as enum ('sales', 'admin');

create type public.conversation_status as enum ('open', 'closed', 'pending');

-- restore profile table
create table public.profile (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  user_name   text not null unique,
  contact_no  text not null,
  role        public.user_role not null default 'technician',
  full_name   text not null,
  is_archived boolean not null default false,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.profile enable row level security;

create policy "profiles_select_authenticated"
  on public.profile for select
  using (auth.role() = 'authenticated');

create policy "profiles_update_own"
  on public.profile for update
  using (auth.uid() = user_id);

-- re-create auto-profile trigger (trigger still exists on auth.users but profile was gone)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profile (user_id, user_name, full_name, contact_no)
  values (
    new.id,
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'contact_no'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- restore messenger_conversation table
create table public.messenger_conversation (
  conversation_id    serial primary key,
  handled_by_user_id uuid references public.profile (user_id) on delete set null,
  handler_role       public.handler_role,
  psid               varchar,
  customer_name      text,
  status             public.conversation_status not null default 'open',
  is_vehicle_inquiry boolean not null default false,
  last_message_at    timestamptz,
  created_at         timestamptz not null default now()
);

alter table public.messenger_conversation enable row level security;

create policy "conversation_select_authenticated"
  on public.messenger_conversation for select
  using (auth.role() = 'authenticated');

-- re-add FK constraints dropped by cascade when profile was dropped
alter table public.job_order
  add constraint job_order_assigned_technician_id_fkey
    foreign key (assigned_technician_id) references public.profile (user_id) on delete set null,
  add constraint job_order_created_by_user_id_fkey
    foreign key (created_by_user_id) references public.profile (user_id) on delete restrict,
  add constraint job_order_operations_user_id_fkey
    foreign key (operations_user_id) references public.profile (user_id) on delete set null,
  add constraint job_order_sales_user_id_fkey
    foreign key (sales_user_id) references public.profile (user_id) on delete set null;

alter table public.job_stage_documentation
  add constraint job_stage_documentation_submitted_by_user_id_fkey
    foreign key (submitted_by_user_id) references public.profile (user_id) on delete set null;

alter table public.status_log
  add constraint status_log_changed_by_user_id_fkey
    foreign key (changed_by_user_id) references public.profile (user_id) on delete set null;

alter table public.job_concern
  add constraint job_concern_submitted_by_user_id_fkey
    foreign key (submitted_by_user_id) references public.profile (user_id) on delete set null,
  add constraint job_concern_resolved_by_user_id_fkey
    foreign key (resolved_by_user_id) references public.profile (user_id) on delete set null;

alter table public.operations_notification
  add constraint operations_notification_sent_to_user_id_fkey
    foreign key (sent_to_user_id) references public.profile (user_id) on delete set null;

alter table public.offline_sync_queue
  add constraint offline_sync_queue_user_id_fkey
    foreign key (user_id) references public.profile (user_id) on delete set null;

alter table public.sync_conflict_log
  add constraint sync_conflict_log_resolved_by_user_id_fkey
    foreign key (resolved_by_user_id) references public.profile (user_id) on delete set null;

-- re-add FK constraints dropped by cascade when messenger_conversation was dropped
alter table public.messenger_message
  add constraint messenger_message_conversation_id_fkey
    foreign key (conversation_id) references public.messenger_conversation (conversation_id) on delete cascade,
  add constraint messenger_message_sent_by_user_id_fkey
    foreign key (sent_by_user_id) references public.profile (user_id) on delete set null;

alter table public.message_template
  add constraint message_template_created_by_user_id_fkey
    foreign key (created_by_user_id) references public.profile (user_id) on delete set null;
