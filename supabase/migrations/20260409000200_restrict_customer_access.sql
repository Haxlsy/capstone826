-- Disable customer_intake and customer access via RLS
-- Only users with sales or admin role can access

-- First, drop existing customer_intake policies if they exist
drop policy if exists "customer_intake_select_authenticated" on public.customer_intake;
drop policy if exists "customer_intake_insert_authenticated" on public.customer_intake;
drop policy if exists "customer_intake_update_authenticated" on public.customer_intake;

-- Create restrictive RLS policies for customer_intake (sales/admin only)
create policy "customer_intake_access_sales_admin"
  on public.customer_intake for select
  using (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );

create policy "customer_intake_insert_sales_admin"
  on public.customer_intake for insert
  with check (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );

create policy "customer_intake_update_sales_admin"
  on public.customer_intake for update
  using (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );

-- Similar restrictions for customer table
drop policy if exists "customer_select_authenticated" on public.customer;
drop policy if exists "customer_insert_authenticated" on public.customer;
drop policy if exists "customer_update_authenticated" on public.customer;

create policy "customer_access_sales_admin"
  on public.customer for select
  using (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );

create policy "customer_insert_sales_admin"
  on public.customer for insert
  with check (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );

create policy "customer_update_sales_admin"
  on public.customer for update
  using (
    exists (
      select 1 from public.profile
      where profile.user_id = auth.uid()
      and profile.role in ('sales', 'admin', 'super_admin')
    )
  );
