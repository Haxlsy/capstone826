-- drop messenger_conversation first since it depends on profile
drop table if exists public.messenger_conversation cascade;
drop table if exists public.profile cascade;

-- drop their related types
drop type if exists public.handler_role cascade;
drop type if exists public.conversation_status cascade;
drop type if exists public.user_role cascade;