-- =================================================================
-- Migration: notification table + recorded inquiry_status value
-- =================================================================

-- Add 'recorded' to the inquiry_status enum
ALTER TYPE inquiry_status ADD VALUE IF NOT EXISTS 'recorded';

-- =================================================================
-- NOTIFICATION
-- In-app notifications for head_detailer / head_installer.
-- Currently used for Operations → Head Tech rework alerts.
-- =================================================================

CREATE TABLE IF NOT EXISTS notification (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,          -- e.g. 'rework', 'concern_resolved'
  message       TEXT        NOT NULL,
  job_order_id  UUID        REFERENCES job_order(id) ON DELETE CASCADE,
  stage_id      UUID        REFERENCES job_stage_progress(id) ON DELETE SET NULL,
  is_read       BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_user_id   ON notification (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_is_read   ON notification (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_job_order ON notification (job_order_id);

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (admin client), so a permissive policy for
-- authenticated reads of own notifications is sufficient for the app client.
CREATE POLICY "Users read own notifications"
  ON notification FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON notification FOR UPDATE
  USING (user_id = auth.uid());
