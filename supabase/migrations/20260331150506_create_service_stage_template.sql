create table public.service_stage_template (
  stage_template_id      serial primary key,
  service_id             int not null references public.service (service_id) on delete cascade,
  vehicle_type_id        int not null references public.vehicle_type (vehicle_type_id) on delete cascade,
  stage_name             varchar not null,
  stage_order            int not null,
  requires_photo         boolean not null default false,
  requires_video         boolean not null default false,
  estimated_duration_min int,
  is_active              boolean not null default true
);

create index on public.service_stage_template (service_id);
create index on public.service_stage_template (vehicle_type_id);

alter table public.service_stage_template enable row level security;

create policy "stage_template_select_authenticated"
  on public.service_stage_template for select
  using (auth.role() = 'authenticated');