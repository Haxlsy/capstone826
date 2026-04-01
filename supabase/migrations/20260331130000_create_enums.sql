create type public.user_role as enum (
  'admin', 'head_technician', 'technician', 'operations', 'sales'
);

create type public.job_status as enum (
  'pending', 'ongoing', 'quality_check', 'completed',
  'delayed', 'cancelled', 'released'
);

create type public.payment_status as enum (
  'unpaid', 'partial', 'paid'
);

create type public.stage_status as enum (
  'pending', 'done', 'rework'
);

create type public.sync_status as enum (
  'pending', 'synced', 'conflict', 'failed'
);

create type public.entity_type as enum (
  'job_order', 'stage_doc', 'concern', 'status_log'
);

create type public.operation_type as enum (
  'insert', 'update', 'delete'
);

create type public.resolution_type as enum (
  'use_local', 'use_server', 'manual'
);

create type public.notification_type as enum (
  'status_update', 'concern_raised', 'delay_alert'
);

create type public.handler_role as enum (
  'sales', 'admin'
);

create type public.concern_status as enum (
  'open', 'resolved', 'dismissed'
);

create type public.media_type as enum (
  'image', 'video'
);

create type public.conversation_status as enum (
  'open', 'closed', 'pending'
);

create type public.visible_to_role as enum (
  'all', 'sales', 'admin'
);

create type public.trigger_status as enum (
  'pending', 'ongoing', 'quality_check', 'completed',
  'delayed', 'cancelled', 'released'
);