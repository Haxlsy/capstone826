-- =================================================================
-- 826 AUTO CARE — DB FUNCTIONS v2 (aligned with schema rebuild v2.1)
-- Replaces all functions from 000001 with corrected column references.
-- =================================================================

-- -----------------------------------------------------------------
-- handle_new_user
-- Fires after every INSERT on auth.users.
-- Creates a matching user_account row using metadata passed in
-- auth.admin.createUser({ user_metadata: { username, full_name } })
-- Role defaults to 'sales'; the create-account API updates it
-- immediately after Auth user creation.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_account (id, full_name, username, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'sales'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------------
-- get_user_email_by_username
-- Used by the login API to resolve a username → Supabase Auth email.
-- Called via supabase.rpc('get_user_email_by_username', { p_username })
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.user_account ua ON ua.id = au.id
  WHERE ua.username = p_username
    AND ua.is_archived = false
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------
-- auto_create_job_stage_progress
-- Fires after INSERT on job_order.
-- Seeds one job_stage_progress row per service_stage
-- that belongs to the selected service.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_job_stage_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_stage_progress (job_order_id, service_stage_id)
  SELECT NEW.id, ss.id
  FROM public.service_stage ss
  WHERE ss.service_id = NEW.service_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_job_order_created ON public.job_order;

CREATE TRIGGER on_job_order_created
  AFTER INSERT ON public.job_order
  FOR EACH ROW EXECUTE FUNCTION auto_create_job_stage_progress();

-- -----------------------------------------------------------------
-- log_job_status_change (helper function — not auto-triggered)
-- The API inserts job_order_history rows explicitly with the real
-- changed_by_id. This function is kept for optional trigger use.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_order_history (job_order_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
