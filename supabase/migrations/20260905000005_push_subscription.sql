-- OS-level push notifications for technicians (and any other staff role later).
--
-- A user can have more than one subscribed device (e.g. a phone added to the
-- home screen plus a desktop browser), so this is a one-to-many table keyed
-- on the unique Push API `endpoint`, not a single column on user_account.
--
-- Writes go through the service-role API routes (app/api/push/subscribe,
-- .../unsubscribe) exactly like every other table in this app, so RLS here
-- only needs to cover the Realtime/anon-key read path — a signed-in user may
-- see/manage their own subscription rows, nothing else.

CREATE TABLE IF NOT EXISTS push_subscription (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscription_user_id_idx ON push_subscription(user_id);

ALTER TABLE push_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_push_subscription" ON push_subscription;
CREATE POLICY "own_push_subscription"
  ON push_subscription FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
