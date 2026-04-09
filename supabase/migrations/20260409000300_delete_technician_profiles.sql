-- Delete all technician role profiles
-- This permanently removes technician accounts from the system
-- Retain: super_admin, admin, operations, sales, head_technician

delete from public.profile
where role = 'technician';

-- Note: We cannot remove enum values from user_role in PostgreSQL without recreating the type.
-- The 'technician' enum value will remain in the database but no new profiles can have this role.
-- To fully remove it, you would need to:
-- 1. Create a new enum type without 'technician'
-- 2. Alter the profile table to use the new enum
-- 3. Drop the old enum
-- This is a more complex migration that requires downtime, so we keep the enum as-is for now.
