-- =================================================================
-- STEP 1 of 2 — one `customer` per person; vehicles reference it.
--
-- Additive and safe with the OLD app code still running: nothing is
-- dropped and the new columns are nullable. Run scripts/
-- customer_backfill_precheck.sql first and read its output.
-- Step 2 (20260926000003_customer_cutover.sql) runs AFTER the new
-- code is deployed.
--
--   customer         the person: name, phone, email and the ONE
--                    unique Messenger id (psid)
--   customer_record  stays as the VEHICLE table (plate, vehicle unit).
--                    job_order.customer_record_id still points here.
--     customer_id            → the owning customer
--     booked_by_customer_id  → for a booking made for someone else, the
--                              customer whose Messenger account booked
--                              it (job updates go to that account). A
--                              reference, not a copy: relink / unlink /
--                              delete follow automatically.
-- =================================================================

-- Guard: the notify_psid migration may not have been run yet.
ALTER TABLE customer_record ADD COLUMN IF NOT EXISTS notify_psid VARCHAR(100);

-- SQL port of lib/phone.ts normalizePhone().
CREATE OR REPLACE FUNCTION public.normalize_ph_phone(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d = '' THEN ''
    WHEN d LIKE '63%' AND length(d) = 12 THEN '0' || substr(d, 3)
    WHEN length(d) = 10 THEN '0' || d
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(raw, ''), '\D', '', 'g') AS d) s
$$;

CREATE TABLE IF NOT EXISTS customer (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(255) NOT NULL,
  contact_number VARCHAR(20),
  email          VARCHAR(255),
  psid           VARCHAR(100) UNIQUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_contact ON customer (contact_number);
CREATE INDEX IF NOT EXISTS idx_customer_email   ON customer (lower(email));

ALTER TABLE customer ENABLE ROW LEVEL SECURITY;

-- Same audience as customer_record (PII): Sales / Admin only. Writes go
-- through the service role.
DROP POLICY IF EXISTS "sales_admin_read_customer" ON customer;
CREATE POLICY "sales_admin_read_customer"
  ON customer FOR SELECT
  TO authenticated
  USING (public.current_staff_role() IN ('sales', 'admin', 'super_admin'));

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE customer;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'customer is already in supabase_realtime, skipping.';
END $$;

ALTER TABLE customer_record
  ADD COLUMN IF NOT EXISTS customer_id UUID
    REFERENCES customer(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS booked_by_customer_id UUID
    REFERENCES customer(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_record_customer
  ON customer_record (customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_record_booked_by
  ON customer_record (booked_by_customer_id);

-- =================================================================
-- BACKFILL — group the existing vehicle rows into customers.
-- Mirrors lib/customers/backfill.ts (which is unit tested):
--   * a row that holds a psid anchors a customer (one per psid);
--   * a row with a notify_psid and the SAME phone as that psid holder
--     is the same person; with a DIFFERENT phone it is another person
--     who was booked from that Messenger account → its own customer,
--     booked_by_customer_id = the psid holder's customer;
--   * a row with no psid joins the customer with the same PLAUSIBLE
--     mobile number when exactly one psid holder has it; otherwise rows
--     sharing a plausible number group together; anything else is a
--     customer of its own;
--   * name / email / phone come from the psid holder, else the oldest
--     row (email falls back to any row in the group that has one).
-- =================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM customer_record WHERE customer_id IS NULL) THEN

    CREATE TEMP TABLE _rec ON COMMIT DROP AS
    SELECT id, psid, notify_psid, created_at, full_name, email, contact_number,
           public.normalize_ph_phone(contact_number) AS phone,
           public.normalize_ph_phone(contact_number) ~ '^09[0-9]{9}$' AS plausible
      FROM customer_record
     WHERE customer_id IS NULL;

    CREATE TEMP TABLE _anchor ON COMMIT DROP AS
    SELECT psid, phone, plausible FROM _rec WHERE psid IS NOT NULL;

    CREATE TEMP TABLE _phone_anchor ON COMMIT DROP AS
    SELECT phone, (array_agg(psid))[1] AS psid
      FROM _anchor
     WHERE plausible
     GROUP BY phone
    HAVING count(*) = 1;

    CREATE TEMP TABLE _grp ON COMMIT DROP AS
    SELECT r.id AS record_id,
           CASE
             WHEN r.psid IS NOT NULL THEN 'psid:' || r.psid
             WHEN r.notify_psid IS NOT NULL AND EXISTS (
                    SELECT 1 FROM _anchor a
                     WHERE a.psid = r.notify_psid
                       AND a.plausible AND a.phone = r.phone)
               THEN 'psid:' || r.notify_psid
             WHEN r.notify_psid IS NULL AND r.plausible
                  AND EXISTS (SELECT 1 FROM _phone_anchor p WHERE p.phone = r.phone)
               THEN 'psid:' || (SELECT p.psid FROM _phone_anchor p
                                 WHERE p.phone = r.phone)
             WHEN r.plausible THEN 'phone:' || r.phone
             ELSE 'rec:' || r.id::text
           END AS grp,
           CASE
             WHEN r.psid IS NULL AND r.notify_psid IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM _anchor a
                     WHERE a.psid = r.notify_psid
                       AND a.plausible AND a.phone = r.phone)
               THEN r.notify_psid
           END AS booked_by_psid
      FROM _rec r;

    CREATE TEMP TABLE _cust ON COMMIT DROP AS
    SELECT DISTINCT ON (g.grp)
           g.grp,
           gen_random_uuid() AS customer_id,
           r.full_name,
           CASE WHEN r.plausible THEN r.phone ELSE r.contact_number END AS contact_number,
           coalesce(
             r.email,
             (SELECT r2.email FROM _grp g2 JOIN _rec r2 ON r2.id = g2.record_id
               WHERE g2.grp = g.grp AND r2.email IS NOT NULL
               ORDER BY r2.created_at, r2.id LIMIT 1)
           ) AS email,
           CASE WHEN g.grp LIKE 'psid:%' THEN substr(g.grp, 6) END AS psid,
           (SELECT min(r3.created_at) FROM _grp g3 JOIN _rec r3 ON r3.id = g3.record_id
             WHERE g3.grp = g.grp) AS created_at
      FROM _grp g
      JOIN _rec r ON r.id = g.record_id
     ORDER BY g.grp, (r.psid IS NULL), r.created_at, r.id;

    -- A psid that already belongs to a customer (a re-run) is reused.
    UPDATE _cust c
       SET customer_id = e.id
      FROM customer e
     WHERE c.psid IS NOT NULL AND e.psid = c.psid;

    INSERT INTO customer (id, full_name, contact_number, email, psid, created_at)
    SELECT c.customer_id, c.full_name, c.contact_number, c.email, c.psid, c.created_at
      FROM _cust c
     WHERE NOT EXISTS (SELECT 1 FROM customer e WHERE e.id = c.customer_id);

    UPDATE customer_record cr
       SET customer_id = c.customer_id
      FROM _grp g
      JOIN _cust c ON c.grp = g.grp
     WHERE cr.id = g.record_id;

    UPDATE customer_record cr
       SET booked_by_customer_id = b.customer_id
      FROM _grp g
      JOIN _cust b ON b.psid = g.booked_by_psid
     WHERE cr.id = g.record_id
       AND g.booked_by_psid IS NOT NULL;
  END IF;
END $$;

-- Sanity check (should be 0 rows left without a customer):
--   SELECT count(*) FROM customer_record WHERE customer_id IS NULL;
