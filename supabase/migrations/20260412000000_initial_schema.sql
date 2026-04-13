-- =================================================================
-- 826 AUTO CARE — DATABASE SCHEMA
-- Version: 2.1  |  Based on ERD v2.1 + Scope v6.1
-- Auth: Supabase Auth (auth.users) — no custom password hashing
-- =================================================================

-- =================================================================
-- DROP EXISTING TYPES (safe re-run — tables already dropped)
-- =================================================================

DROP TYPE IF EXISTS user_role        CASCADE;
DROP TYPE IF EXISTS job_status       CASCADE;
DROP TYPE IF EXISTS stage_type       CASCADE;
DROP TYPE IF EXISTS inquiry_type     CASCADE;
DROP TYPE IF EXISTS concern_status   CASCADE;
DROP TYPE IF EXISTS media_file_type  CASCADE;
DROP TYPE IF EXISTS kb_category      CASCADE;

-- =================================================================
-- ENUMS
-- =================================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'operations',
  'sales',
  'head_detailer',
  'head_installer',
  'installer',
  'detailer'
);

CREATE TYPE job_status AS ENUM (
  'Pending',
  'Ongoing',
  'For Rework',
  'For Release',
  'Released',
  'Delayed',
  'Cancelled'
);

CREATE TYPE stage_type AS ENUM (
  'preparation',    -- handled by Head Detailer team
  'installation'    -- handled by Head Installer team
);

CREATE TYPE inquiry_type AS ENUM (
  'Booking',
  'Human Response',
  'Report'
);

CREATE TYPE concern_status AS ENUM (
  'Pending',
  'Resolved'
);

CREATE TYPE media_file_type AS ENUM (
  'photo',
  'video'
);

CREATE TYPE kb_category AS ENUM (
  'Service',
  'Pricing',
  'Hours',
  'FAQ',
  'Other'
);

-- =================================================================
-- USER ACCOUNTS
-- Extends Supabase auth.users with role and profile data.
-- user_id matches auth.users(id) — Supabase Auth manages all
-- password storage and hashing; no custom hashed_password column.
--
-- Roles:
--   super_admin   — created by developers; manages Admin accounts
--   admin         — manages all non-admin accounts + system config
--   operations    — job management, concerns, service management
--   sales         — inquiry management, customer records
--   head_detailer — preparation stage supervisor (mobile UI)
--   head_installer— installation stage supervisor (mobile UI)
--   installer     — assigned team member (admin tracking only)
--   detailer      — assigned team member (admin tracking only)
-- =================================================================

CREATE TABLE user_account (
  user_id      UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    VARCHAR(255) NOT NULL,
  user_name    VARCHAR(100) NOT NULL UNIQUE,
  role         user_role    NOT NULL,
  contact_no   VARCHAR(20),
  is_archived  BOOLEAN      NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- CHATBOT CONFIGURATION
-- Single-row table. Admin updates the system prompt used by Gemini.
-- =================================================================

CREATE TABLE chatbot_config (
  chatbot_config_id  INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  system_prompt      TEXT        NOT NULL DEFAULT '',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed single config row
INSERT INTO chatbot_config (system_prompt) VALUES ('');

-- =================================================================
-- CHATBOT KNOWLEDGE BASE
-- FAQ and service info entries used by the AI chatbot for responses.
-- Admin can add, edit, or remove entries.
-- =================================================================

CREATE TABLE chatbot_knowledge (
  chatbot_knowledge_id  INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  category              kb_category NOT NULL,
  question              TEXT        NOT NULL,
  content               TEXT        NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- TOPICS
-- Tracks Messenger conversation topic state per PSID.
-- Used by the AI chatbot to determine current conversation context
-- and escalation triggers. entity_id optionally links to a
-- customer_record or inquiry_record depending on context.
-- =================================================================

CREATE TABLE topics (
  topics_id      INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  psid           VARCHAR(100) NOT NULL,
  topic_type     VARCHAR(100),
  human_takeover BOOLEAN      NOT NULL DEFAULT false,
  entity_id      UUID,                             -- optional context link
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- CUSTOMER RECORDS
-- Confirmed booking records generated by Sales from the Inquiry
-- Management Module. Contains customer identity and vehicle details.
--
-- Dual purpose:
--   1. Autofill in Job Management (Operations)
--   2. Chatbot status lookups: PSID → plate_number → job status
-- =================================================================

CREATE TABLE customer_record (
  customer_record_id  INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fb_name             VARCHAR(255),                -- Facebook Messenger display name
  full_name           VARCHAR(255) NOT NULL,
  contact_number      VARCHAR(20)  NOT NULL,
  email               VARCHAR(255),
  plate_number        VARCHAR(50)  NOT NULL,
  vehicle_unit        VARCHAR(255) NOT NULL,
  psid                VARCHAR(100) UNIQUE,          -- Messenger Page-Scoped ID
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- INQUIRY RECORDS
-- Escalated Messenger conversations visible in Sales' Inquiry
-- Management Module. Auto-created by the webhook when the chatbot
-- flags a conversation for human intervention.
--
-- inquiry_type:
--   Booking       — customer wants to book a service
--   Human Response— general escalation needing human reply
--   Report        — customer reporting a concern
--
-- ai_* fields are populated by the chatbot during Booking flows.
-- customer_record_id is set when Sales confirms and clicks
-- "Record Customer Details."
-- =================================================================

CREATE TABLE inquiry_record (
  inquiry_id            INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  psid                  VARCHAR(100) NOT NULL,
  fb_name               VARCHAR(255) NOT NULL,
  inquiry_type          inquiry_type NOT NULL,
  is_available_human    BOOLEAN      NOT NULL DEFAULT true,
  is_archived           BOOLEAN      NOT NULL DEFAULT false,
  has_customer_record   BOOLEAN      NOT NULL DEFAULT false,

  -- AI-extracted fields from the chatbot booking conversation
  ai_full_name          VARCHAR(255),
  ai_contact_number     VARCHAR(20),
  ai_plate_number       VARCHAR(50),
  ai_vehicle_unit       VARCHAR(255),

  -- Resolution
  is_resolved           BOOLEAN      NOT NULL DEFAULT false,
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID         REFERENCES user_account(user_id) ON DELETE SET NULL,

  -- Set when Sales generates a customer record from this inquiry
  customer_record_id    INT          REFERENCES customer_record(customer_record_id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- SERVICES
-- Created and managed by Operations.
-- Each service defines workflow stages via service_stage_template.
-- =================================================================

CREATE TABLE service (
  service_id    INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  duration_est  INT,                              -- estimated total hours
  is_archived   BOOLEAN      NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- SERVICE STAGE TEMPLATES
-- Ordered workflow stages per service.
--   preparation  → Head Detailer team
--   installation → Head Installer team
-- =================================================================

CREATE TABLE service_stage_template (
  service_stage_template_id  INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  service_id                 INT          NOT NULL REFERENCES service(service_id) ON DELETE CASCADE,
  name                       VARCHAR(255) NOT NULL,
  stage_order                INT          NOT NULL,
  stage_type                 stage_type   NOT NULL,
  duration_est               INT,                  -- estimated minutes
  created_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ  NOT NULL DEFAULT now(),

  UNIQUE (service_id, stage_order)
);

-- =================================================================
-- JOB ORDERS
-- Core operational record. Created by Operations.
-- Links a customer record, service, head technicians, and tracks
-- the job lifecycle from Pending → Released.
--
-- customer_record_id: set when customer booked via Messenger.
-- manual_* fields: used when the customer did not book via Messenger
--   and Operations enters details manually.
-- =================================================================

CREATE TABLE job_order (
  job_id                INT          PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_record_id    INT          REFERENCES customer_record(customer_record_id) ON DELETE SET NULL,
  created_by            UUID         NOT NULL REFERENCES user_account(user_id),
  service_id            INT          NOT NULL REFERENCES service(service_id),
  head_detailer_id      UUID         REFERENCES user_account(user_id) ON DELETE SET NULL,
  head_installer_id     UUID         REFERENCES user_account(user_id) ON DELETE SET NULL,

  -- Manual customer/vehicle entry (when no Messenger booking exists)
  manual_customer_name  VARCHAR(255),
  manual_contact_number VARCHAR(20),
  manual_plate_number   VARCHAR(50),
  manual_vehicle_unit   VARCHAR(255),

  status                job_status   NOT NULL DEFAULT 'Pending',
  scheduled_start       TIMESTAMPTZ,
  actual_start          TIMESTAMPTZ,
  expected_completion   TIMESTAMPTZ,

  -- Populated by Head Detailer when approving preparation handoff to Head Installer
  handoff_notes         TEXT,

  -- Populated by Operations when confirming vehicle release
  is_released           BOOLEAN      NOT NULL DEFAULT false,
  released_at           TIMESTAMPTZ,
  released_by           UUID         REFERENCES user_account(user_id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- JOB STAGE PROGRESS
-- One row per (job_id × service_stage_template_id).
-- Created automatically when a job order is created (seeded from
-- the service's stage templates).
-- =================================================================

CREATE TABLE job_stage_progress (
  job_stage_id               INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  job_id                     INT         NOT NULL REFERENCES job_order(job_id) ON DELETE CASCADE,
  service_stage_template_id  INT         NOT NULL REFERENCES service_stage_template(service_stage_template_id),
  is_done                    BOOLEAN     NOT NULL DEFAULT false,
  rework_note                TEXT,                 -- written by Head Detailer/Installer when flagging rework
  submitted_at               TIMESTAMPTZ,          -- when stage was marked done
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (job_id, service_stage_template_id)
);

-- =================================================================
-- STAGE MEDIA
-- Photos and videos uploaded per completed stage.
-- url is the Supabase Storage public/signed URL.
-- =================================================================

CREATE TABLE stage_media (
  stage_media_id  INT              PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  job_stage_id    INT              NOT NULL REFERENCES job_stage_progress(job_stage_id) ON DELETE CASCADE,
  url             TEXT             NOT NULL,
  media_file_type media_file_type  NOT NULL,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- =================================================================
-- JOB ORDER HISTORY
-- Immutable status-change log per job order.
-- Displayed as timeline in Operations and Head Detailer/Installer views.
-- =================================================================

CREATE TABLE job_order_history (
  job_order_history_id  INT         PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  job_id                INT         NOT NULL REFERENCES job_order(job_id) ON DELETE CASCADE,
  status                job_status  NOT NULL,
  changed_by            UUID        REFERENCES user_account(user_id) ON DELETE SET NULL,
  changed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- CONCERN RECORDS
-- Submitted by Head Detailer or Head Installer to Operations.
-- Operations can resolve and optionally attach a response note.
-- =================================================================

CREATE TABLE concern_record (
  concern_id     INT            PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  job_id         INT            NOT NULL REFERENCES job_order(job_id) ON DELETE CASCADE,
  submitted_by   UUID           NOT NULL REFERENCES user_account(user_id),
  title          VARCHAR(255)   NOT NULL,
  description    TEXT           NOT NULL,
  status         concern_status NOT NULL DEFAULT 'Pending',
  response_note  TEXT,
  responded_at   TIMESTAMPTZ,
  responded_by   UUID           REFERENCES user_account(user_id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- =================================================================
-- CONCERN MEDIA
-- Optional photos/videos attached to a concern submission.
-- url is the Supabase Storage public/signed URL.
-- =================================================================

CREATE TABLE concern_media (
  concern_media_id  INT              PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  concern_id        INT              NOT NULL REFERENCES concern_record(concern_id) ON DELETE CASCADE,
  url               TEXT             NOT NULL,
  media_file_type   media_file_type  NOT NULL,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- =================================================================
-- AUTO-UPDATE updated_at TRIGGER
-- =================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_account_updated_at
  BEFORE UPDATE ON user_account
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_chatbot_config_updated_at
  BEFORE UPDATE ON chatbot_config
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_chatbot_knowledge_updated_at
  BEFORE UPDATE ON chatbot_knowledge
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_topics_updated_at
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_customer_record_updated_at
  BEFORE UPDATE ON customer_record
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_inquiry_record_updated_at
  BEFORE UPDATE ON inquiry_record
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_service_updated_at
  BEFORE UPDATE ON service
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_service_stage_template_updated_at
  BEFORE UPDATE ON service_stage_template
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_job_order_updated_at
  BEFORE UPDATE ON job_order
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_job_stage_progress_updated_at
  BEFORE UPDATE ON job_stage_progress
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_concern_record_updated_at
  BEFORE UPDATE ON concern_record
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =================================================================
-- INDEXES
-- =================================================================

-- user_account
CREATE INDEX idx_user_account_role        ON user_account(role);
CREATE INDEX idx_user_account_is_archived ON user_account(is_archived);

-- customer_record
CREATE INDEX idx_customer_record_psid     ON customer_record(psid);
CREATE INDEX idx_customer_record_plate    ON customer_record(plate_number);

-- inquiry_record
CREATE INDEX idx_inquiry_psid             ON inquiry_record(psid);
CREATE INDEX idx_inquiry_type             ON inquiry_record(inquiry_type);
CREATE INDEX idx_inquiry_is_resolved      ON inquiry_record(is_resolved);
CREATE INDEX idx_inquiry_is_archived      ON inquiry_record(is_archived);

-- topics
CREATE INDEX idx_topics_psid              ON topics(psid);

-- service
CREATE INDEX idx_service_is_archived      ON service(is_archived);

-- service_stage_template
CREATE INDEX idx_sst_service_id           ON service_stage_template(service_id);

-- job_order
CREATE INDEX idx_job_status               ON job_order(status);
CREATE INDEX idx_job_customer_record      ON job_order(customer_record_id);
CREATE INDEX idx_job_service              ON job_order(service_id);
CREATE INDEX idx_job_head_detailer        ON job_order(head_detailer_id);
CREATE INDEX idx_job_head_installer       ON job_order(head_installer_id);
CREATE INDEX idx_job_scheduled_start      ON job_order(scheduled_start);
CREATE INDEX idx_job_is_released          ON job_order(is_released);

-- job_stage_progress
CREATE INDEX idx_jsp_job_id               ON job_stage_progress(job_id);

-- stage_media
CREATE INDEX idx_stage_media_stage_id     ON stage_media(job_stage_id);

-- job_order_history
CREATE INDEX idx_joh_job_id               ON job_order_history(job_id);
CREATE INDEX idx_joh_changed_at           ON job_order_history(changed_at);

-- concern_record
CREATE INDEX idx_concern_job_id           ON concern_record(job_id);
CREATE INDEX idx_concern_status           ON concern_record(status);
CREATE INDEX idx_concern_submitted_by     ON concern_record(submitted_by);

-- concern_media
CREATE INDEX idx_concern_media_id         ON concern_media(concern_id);

-- =================================================================
-- ROW LEVEL SECURITY
-- All server-side API routes use the service_role key (bypasses RLS).
-- The anon role is denied by default on all tables.
-- Role-specific policies will be added per-module as the backend
-- is wired up.
-- =================================================================

ALTER TABLE user_account           ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge      ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_record        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_record         ENABLE ROW LEVEL SECURITY;
ALTER TABLE service                ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stage_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order              ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_stage_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE concern_record         ENABLE ROW LEVEL SECURITY;
ALTER TABLE concern_media          ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- END OF SCHEMA
-- =================================================================
