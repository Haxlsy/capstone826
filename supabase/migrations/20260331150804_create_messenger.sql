create table public.messenger_message (
  message_id     serial primary key,
  conversation_id int not null references public.messenger_conversation (conversation_id) on delete cascade,
  sent_by_user_id uuid references public.profile (user_id) on delete set null,
  sender_type    varchar not null,
  message_body   text,
  sent_at        timestamptz not null default now(),
  fb_message_id  varchar
);

create table public.message_template (
  template_id      serial primary key,
  created_by_user_id uuid references public.profile (user_id) on delete set null,
  template_name    varchar not null,
  body_text        text not null,
  trigger_status   public.trigger_status,
  visible_to_role  public.visible_to_role not null default 'all',
  created_at       timestamptz not null default now()
);

create index on public.messenger_conversation (handled_by_user_id);
create index on public.messenger_message (conversation_id);

alter table public.messenger_conversation enable row level security;
alter table public.messenger_message enable row level security;
alter table public.message_template enable row level security;

create policy "conversation_select_authenticated"
  on public.messenger_conversation for select
  using (auth.role() = 'authenticated');

create policy "message_select_authenticated"
  on public.messenger_message for select
  using (auth.role() = 'authenticated');

create policy "template_select_authenticated"
  on public.message_template for select
  using (auth.role() = 'authenticated');