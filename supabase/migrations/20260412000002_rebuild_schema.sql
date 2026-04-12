-- =================================================================
-- 826 AUTO CARE — SCHEMA REBUILD v2.1 (authoritative)
-- Drops all previous tables/types and rebuilds from the final ERD.
-- =================================================================

-- -----------------------------------------------------------------
-- DROP PREVIOUS TABLES (cascade handles FK order)
-- -----------------------------------------------------------------

DROP TABLE IF EXISTS concern_media          CASCADE;
DROP TABLE IF EXISTS concern_record         CASCADE;
DROP TABLE IF EXISTS concern                CASCADE;
DROP TABLE IF EXISTS stage_media            CASCADE;
DROP TABLE IF EXISTS job_stage_progress     CASCADE;
DROP TABLE IF EXISTS job_order_history      CASCADE;
DROP TABLE IF EXISTS job_order_team         CASCADE;
DROP TABLE IF EXISTS job_order              CASCADE;
DROP TABLE IF EXISTS customer_record        CASCADE;
DROP TABLE IF EXISTS service_stage_template CASCADE;
DROP TABLE IF EXISTS service_stage          CASCADE;
DROP TABLE IF EXISTS service                CASCADE;
DROP TABLE IF EXISTS chatbot_knowledge      CASCADE;
DROP TABLE IF EXISTS chatbot_config         CASCADE;
DROP TABLE IF EXISTS inquiry_record         CASCADE;
DROP TABLE IF EXISTS inquiry                CASCADE;
DROP TABLE IF EXISTS topics                 CASCADE;
DROP TABLE IF EXISTS technician             CASCADE;
DROP TABLE IF EXISTS user_account           CASCADE;

-- -----------------------------------------------------------------
-- DROP PREVIOUS ENUMS
-- -----------------------------------------------------------------

-- Old types from prior migrations
DROP TYPE IF EXISTS user_role              CASCADE;
DROP TYPE IF EXISTS job_status             CASCADE;
DROP TYPE IF EXISTS stage_type             CASCADE;
DROP TYPE IF EXISTS inquiry_type           CASCADE;
DROP TYPE IF EXISTS concern_status         CASCADE;
DROP TYPE IF EXISTS media_file_type        CASCADE;
DROP TYPE IF EXISTS kb_category            CASCADE;
-- Additional types that may exist from partial migrations
DROP TYPE IF EXISTS technician_role        CASCADE;
DROP TYPE IF EXISTS service_stage_category CASCADE;
DROP TYPE IF EXISTS job_team_role          CASCADE;
DROP TYPE IF EXISTS stage_progress_status  CASCADE;
DROP TYPE IF EXISTS media_type             CASCADE;
DROP TYPE IF EXISTS inquiry_status         CASCADE;

-- =================================================================
-- ENUMS
-- =================================================================

CREATE TYPE user_role AS ENUM (
  'super_admin',
  'admin',
  'operations',
  'sales',
  'head_detailer',
  'head_installer'
);

CREATE TYPE technician_role AS ENUM (
  'head_detailer',
  'head_installer',
  'detailer',
  'installer'
);

CREATE TYPE service_stage_category AS ENUM (
  'preparation',
  'installation'
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

CREATE TYPE job_team_role AS ENUM (
  'head_detailer',
  'head_installer',
  'detailer',
  'installer'
);

CREATE TYPE stage_progress_status AS ENUM (
  'pending',
  'in_progress',
  'done',
  'for_rework'
);

CREATE TYPE media_type AS ENUM (
  'photo',
  'video'
);

CREATE TYPE concern_status AS ENUM (
  'Pending',
  'Resolved'
);

CREATE TYPE inquiry_type AS ENUM (
  'Booking',
  'Human Response',
  'Report'
);

CREATE TYPE inquiry_status AS ENUM (
  'open',
  'resolved'
);

-- =================================================================
-- USER_ACCOUNT
-- System-accessing staff only (super_admin → head_installer).
-- id references auth.users — Supabase Auth owns the session.
-- password_hash is kept for schema completeness; actual auth is
-- handled by Supabase Auth (auth.users).
-- =================================================================

CREATE TABLE user_account (
  id              UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       VARCHAR(255) NOT NULL,
  username        VARCHAR(100) NOT NULL UNIQUE,
  password_hash   TEXT,
  role            user_role    NOT NULL,
  is_archived     BOOLEAN      NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- TECHNICIAN
-- Detailers and installers — do not access the system.
-- Created by Admin for tracking and job assignment purposes only.
-- =================================================================

CREATE TABLE technician (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name    VARCHAR(255)     NOT NULL,
  role         technician_role  NOT NULL,
  is_available BOOLEAN          NOT NULL DEFAULT true,
  is_archived  BOOLEAN          NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);

-- =================================================================
-- SERVICE
-- =================================================================

CREATE TABLE service (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   VARCHAR(255) NOT NULL,
  description            TEXT,
  estimated_duration_mins INT,
  is_archived            BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- SERVICE_STAGE
-- Ordered workflow stages per service.
-- category: preparation (detailer team) | installation (installer team)
-- =================================================================

CREATE TABLE service_stage (
  id             UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id     UUID                   NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  name           VARCHAR(255)           NOT NULL,
  category       service_stage_category NOT NULL,
  sequence_order INT                    NOT NULL,

  UNIQUE (service_id, sequence_order)
);

-- =================================================================
-- CUSTOMER_RECORD
-- Confirmed customer details recorded by Sales from Messenger booking.
-- psid links the customer's Facebook Messenger account for chatbot lookups.
-- =================================================================

CREATE TABLE customer_record (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20)  NOT NULL,
  email          VARCHAR(255),
  plate_number   VARCHAR(50)  NOT NULL,
  vehicle_unit   VARCHAR(255) NOT NULL,
  psid           VARCHAR(100) UNIQUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- =================================================================
-- JOB_ORDER
-- Core service record. customer_record_id is nullable — manual
-- fields (customer_name, contact_number, plate_number, vehicle_unit)
-- are used when no Messenger booking exists.
-- =================================================================

CREATE TABLE job_order (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_record_id     UUID        REFERENCES customer_record(id) ON DELETE SET NULL,
  service_id             UUID        NOT NULL REFERENCES service(id),
  -- Manual customer/vehicle entry (when no customer_record)
  customer_name          VARCHAR(255),
  contact_number         VARCHAR(20),
  plate_number           VARCHAR(50),
  vehicle_unit           VARCHAR(255),
  status                 job_status  NOT NULL DEFAULT 'Pending',
  scheduled_at           TIMESTAMPTZ,
  actual_start_at        TIMESTAMPTZ,
  expected_completion_at TIMESTAMPTZ,
  is_archived            BOOLEAN     NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- JOB_ORDER_TEAM
-- Maps which user_accounts and technicians are assigned to a job.
-- role_in_job clarifies the capacity each person fills on the job.
-- =================================================================

CREATE TABLE job_order_team (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id     UUID         NOT NULL REFERENCES job_order(id) ON DELETE CASCADE,
  user_account_id  UUID         REFERENCES user_account(id) ON DELETE SET NULL,
  technician_id    UUID         REFERENCES technician(id) ON DELETE SET NULL,
  role_in_job      job_team_role NOT NULL
);

-- =================================================================
-- JOB_STAGE_PROGRESS
-- Per-stage completion tracker. One row per (job_order_id × service_stage_id),
-- seeded automatically when a job order is created.
-- handoff_notes: Head Detailer → Head Installer handoff per stage.
-- =================================================================

CREATE TABLE job_stage_progress (
  id                   UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id         UUID                  NOT NULL REFERENCES job_order(id) ON DELETE CASCADE,
  service_stage_id     UUID                  NOT NULL REFERENCES service_stage(id),
  status               stage_progress_status NOT NULL DEFAULT 'pending',
  rework_instructions  TEXT,
  handoff_notes        TEXT,
  completed_at         TIMESTAMPTZ,
  completed_by_id      UUID                  REFERENCES user_account(id) ON DELETE SET NULL,

  UNIQUE (job_order_id, service_stage_id)
);

-- =================================================================
-- STAGE_MEDIA
-- Photos and videos uploaded per stage. Stored in Supabase Storage;
-- shareable_link is the public/signed URL for chatbot status updates.
-- =================================================================

CREATE TABLE stage_media (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_stage_progress_id UUID       NOT NULL REFERENCES job_stage_progress(id) ON DELETE CASCADE,
  media_type           media_type  NOT NULL,
  file_url             TEXT        NOT NULL,
  shareable_link       TEXT,
  file_size_bytes      INT,
  uploaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by_id       UUID        REFERENCES user_account(id) ON DELETE SET NULL
);

-- =================================================================
-- CONCERN
-- Submitted by Head Detailer or Head Installer to Operations.
-- =================================================================

CREATE TABLE concern (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id    UUID            NOT NULL REFERENCES job_order(id) ON DELETE CASCADE,
  submitted_by_id UUID            NOT NULL REFERENCES user_account(id),
  title           VARCHAR(255)    NOT NULL,
  description     TEXT            NOT NULL,
  status          concern_status  NOT NULL DEFAULT 'Pending',
  response_note   TEXT,
  submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by_id  UUID            REFERENCES user_account(id) ON DELETE SET NULL
);

-- =================================================================
-- CONCERN_MEDIA
-- Optional photos/videos attached to a concern.
-- =================================================================

CREATE TABLE concern_media (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_id      UUID        NOT NULL REFERENCES concern(id) ON DELETE CASCADE,
  media_type      media_type  NOT NULL,
  file_url        TEXT        NOT NULL,
  shareable_link  TEXT,
  file_size_bytes INT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- INQUIRY
-- Escalated Messenger conversations surfaced in Sales' Inquiry
-- Management Module.
-- =================================================================

CREATE TABLE inquiry (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  messenger_name  VARCHAR(255)    NOT NULL,
  psid            VARCHAR(100)    NOT NULL,
  inquiry_type    inquiry_type    NOT NULL,
  status          inquiry_status  NOT NULL DEFAULT 'open',
  escalated_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by_id  UUID            REFERENCES user_account(id) ON DELETE SET NULL
);

-- =================================================================
-- CHATBOT_CONFIG
-- Single-row table. Admin updates the system prompt.
-- =================================================================

CREATE TABLE chatbot_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt   TEXT        NOT NULL DEFAULT '',
  updated_by_id   UUID        REFERENCES user_account(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO chatbot_config (id, system_prompt)
VALUES (gen_random_uuid(), '');

-- =================================================================
-- CHATBOT_KNOWLEDGE
-- Knowledge base entries used by the AI chatbot.
-- =================================================================

CREATE TABLE chatbot_knowledge (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_config_id UUID        NOT NULL REFERENCES chatbot_config(id) ON DELETE CASCADE,
  topic             VARCHAR(255) NOT NULL,
  content           TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- JOB_ORDER_HISTORY
-- Immutable log of job order status changes.
-- =================================================================

CREATE TABLE job_order_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id  UUID        NOT NULL REFERENCES job_order(id) ON DELETE CASCADE,
  status        job_status  NOT NULL,
  changed_by_id UUID        REFERENCES user_account(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =================================================================
-- INDEXES
-- =================================================================

CREATE INDEX idx_user_account_username   ON user_account(username);
CREATE INDEX idx_user_account_role       ON user_account(role);
CREATE INDEX idx_user_account_archived   ON user_account(is_archived);

CREATE INDEX idx_technician_role         ON technician(role);
CREATE INDEX idx_technician_available    ON technician(is_available);
CREATE INDEX idx_technician_archived     ON technician(is_archived);

CREATE INDEX idx_service_archived        ON service(is_archived);

CREATE INDEX idx_service_stage_service   ON service_stage(service_id);
CREATE INDEX idx_service_stage_order     ON service_stage(service_id, sequence_order);

CREATE INDEX idx_customer_record_psid    ON customer_record(psid);
CREATE INDEX idx_customer_record_plate   ON customer_record(plate_number);

CREATE INDEX idx_job_order_status        ON job_order(status);
CREATE INDEX idx_job_order_customer      ON job_order(customer_record_id);
CREATE INDEX idx_job_order_service       ON job_order(service_id);
CREATE INDEX idx_job_order_scheduled     ON job_order(scheduled_at);
CREATE INDEX idx_job_order_archived      ON job_order(is_archived);

CREATE INDEX idx_job_order_team_job      ON job_order_team(job_order_id);
CREATE INDEX idx_job_order_team_user     ON job_order_team(user_account_id);
CREATE INDEX idx_job_order_team_tech     ON job_order_team(technician_id);

CREATE INDEX idx_job_stage_job           ON job_stage_progress(job_order_id);
CREATE INDEX idx_job_stage_status        ON job_stage_progress(status);

CREATE INDEX idx_stage_media_stage       ON stage_media(job_stage_progress_id);

CREATE INDEX idx_concern_job             ON concern(job_order_id);
CREATE INDEX idx_concern_status          ON concern(status);
CREATE INDEX idx_concern_submitter       ON concern(submitted_by_id);

CREATE INDEX idx_concern_media_concern   ON concern_media(concern_id);

CREATE INDEX idx_inquiry_psid            ON inquiry(psid);
CREATE INDEX idx_inquiry_type            ON inquiry(inquiry_type);
CREATE INDEX idx_inquiry_status          ON inquiry(status);

CREATE INDEX idx_chatbot_knowledge_config ON chatbot_knowledge(chatbot_config_id);

CREATE INDEX idx_job_history_job         ON job_order_history(job_order_id);
CREATE INDEX idx_job_history_created     ON job_order_history(created_at);

-- =================================================================
-- UPDATED_AT TRIGGER
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

CREATE TRIGGER trg_technician_updated_at
  BEFORE UPDATE ON technician
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_chatbot_knowledge_updated_at
  BEFORE UPDATE ON chatbot_knowledge
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- =================================================================
-- ROW LEVEL SECURITY
-- Server-side routes use service_role key (bypasses RLS).
-- anon role denied by default on all tables.
-- =================================================================

ALTER TABLE user_account        ENABLE ROW LEVEL SECURITY;
ALTER TABLE technician          ENABLE ROW LEVEL SECURITY;
ALTER TABLE service             ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stage       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_record     ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order           ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_team      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_stage_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_media         ENABLE ROW LEVEL SECURITY;
ALTER TABLE concern             ENABLE ROW LEVEL SECURITY;
ALTER TABLE concern_media       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_knowledge   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_order_history   ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- END OF SCHEMA
-- =================================================================
