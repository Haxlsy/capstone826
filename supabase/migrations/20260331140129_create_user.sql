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

-- auto-create profile on signup
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();