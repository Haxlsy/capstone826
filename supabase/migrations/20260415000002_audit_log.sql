-- ================================================================
-- AUDIT LOG
-- Tracks user actions across all roles. Seeded by server-side API
-- routes using the admin client, so RLS only needs a read policy
-- for admin/super_admin.
-- ================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES user_account(id) ON DELETE SET NULL,
  user_name   TEXT        NOT NULL,
  role        TEXT        NOT NULL,
  category    TEXT        NOT NULL,   -- auth | view | create | update | approve | flag | delete | message
  action      TEXT        NOT NULL,
  target      TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user    ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_role    ON audit_log(role);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admins and super admins can read all logs
CREATE POLICY "Admins can read audit log"
  ON audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_account
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
        AND is_archived = false
    )
  );
