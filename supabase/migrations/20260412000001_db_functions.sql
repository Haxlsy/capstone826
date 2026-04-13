-- =================================================================
-- 826 AUTO CARE — DB FUNCTIONS & TRIGGERS
-- =================================================================

-- -----------------------------------------------------------------
-- handle_new_user
-- Fires after every INSERT on auth.users.
-- Creates a matching user_account row using metadata passed in
-- auth.admin.createUser({ user_metadata: { user_name, full_name, contact_no } })
-- Role defaults to 'detailer' and is updated by the create-account API
-- immediately after creation.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_account (user_id, full_name, user_name, role, contact_no)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1)),
    'detailer',
    COALESCE(NEW.raw_user_meta_data->>'contact_no', NULL)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
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
  JOIN public.user_account ua ON ua.user_id = au.id
  WHERE ua.user_name = p_username
    AND ua.is_archived = false
  LIMIT 1;
$$;

-- Grant execute to anon and authenticated so the login route can call it
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO anon, authenticated;

-- -----------------------------------------------------------------
-- auto_create_job_stage_progress
-- Fires after INSERT on job_order.
-- Seeds one job_stage_progress row per service_stage_template
-- that belongs to the selected service.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION auto_create_job_stage_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_stage_progress (job_id, service_stage_template_id)
  SELECT NEW.job_id, sst.service_stage_template_id
  FROM public.service_stage_template sst
  WHERE sst.service_id = NEW.service_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_job_order_created
  AFTER INSERT ON public.job_order
  FOR EACH ROW EXECUTE FUNCTION auto_create_job_stage_progress();

-- -----------------------------------------------------------------
-- log_job_status_change
-- Fires after UPDATE on job_order when status changes.
-- Inserts a row into job_order_history automatically.
-- -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.job_order_history (job_id, status, changed_by)
    VALUES (NEW.job_id, NEW.status, NEW.updated_at::text::uuid)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Note: changed_by is populated by the API (passed in the update payload).
-- The trigger above is a safety net; the API inserts history rows explicitly
-- with the real user_id, so we do not create this trigger automatically.
-- Keeping the function here for reference / optional use.
