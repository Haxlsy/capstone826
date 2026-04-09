-- Change default role from 'technician' to 'head_technician'
-- This ensures new profiles without role assignment have a valid role
alter table public.profile
  alter column role set default 'head_technician';
