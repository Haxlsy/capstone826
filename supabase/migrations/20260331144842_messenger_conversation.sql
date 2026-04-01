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