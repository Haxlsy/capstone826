-- Delay notifications: remembers which delays were already announced, so the
-- scheduled check (app/api/cron/job-delays, every 5 minutes) tells the head
-- technicians and Operations about each delay exactly once.
--
-- alert_key is "job:<deadline>" or "stage:<stage id>:<expected end>:<rework round>"
-- (see lib/job-delay-alerts.ts). Only the service role reads or writes it.

CREATE TABLE IF NOT EXISTS job_delay_alert (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_order_id  uuid NOT NULL REFERENCES job_order(id) ON DELETE CASCADE,
  alert_key     text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_delay_alert_unique UNIQUE (job_order_id, alert_key)
);

ALTER TABLE job_delay_alert ENABLE ROW LEVEL SECURITY;
