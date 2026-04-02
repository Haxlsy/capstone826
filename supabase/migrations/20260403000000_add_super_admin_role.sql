-- Add super_admin to the user_role enum.
-- super_admin is the only role that can create admin accounts.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
