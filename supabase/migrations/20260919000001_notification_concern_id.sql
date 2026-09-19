-- Lets a "concern" notification (Operations, from a head technician's report)
-- open the specific concern instead of the job order it belongs to.
-- See app/api/head-technician/concerns/route.ts and lib/notification-href.ts.
ALTER TABLE notification
  ADD COLUMN IF NOT EXISTS concern_id UUID REFERENCES concern(id) ON DELETE SET NULL;
