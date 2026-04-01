-- Returns the email for a given username so the app can sign in via Supabase Auth.
-- security definer lets the function access auth.users without exposing it to the client.
create or replace function public.get_user_email_by_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select au.email into v_email
  from auth.users au
  join public.profile p on p.user_id = au.id
  where p.user_name = p_username
    and p.is_archived = false;
  return v_email;
end;
$$;

grant execute on function public.get_user_email_by_username(text) to anon, authenticated;
