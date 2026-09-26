-- =================================================================
-- STEP 2 of 2 — run ONLY after the new code (which reads name / phone /
-- email / psid from `customer`) is deployed and working.
--
-- 1. Attach rows the OLD code created between step 1 and the deploy.
-- 2. Make customer_id required.
-- 3. Drop the per-vehicle copies of the person's details, including
--    notify_psid (replaced by booked_by_customer_id).
-- =================================================================
DO $$
DECLARE
  r RECORD;
  cid UUID;
  phone TEXT;
  matches INT;
BEGIN
  FOR r IN
    SELECT id, full_name, email, contact_number, psid, notify_psid, created_at
      FROM customer_record
     WHERE customer_id IS NULL
     ORDER BY created_at, id
  LOOP
    cid := NULL;
    phone := public.normalize_ph_phone(r.contact_number);

    IF r.psid IS NOT NULL THEN
      SELECT id INTO cid FROM customer WHERE psid = r.psid;
    END IF;

    IF cid IS NULL AND r.notify_psid IS NOT NULL THEN
      -- booked for someone else from a linked Messenger account
      SELECT id INTO cid FROM customer
       WHERE public.normalize_ph_phone(contact_number) = phone
         AND phone ~ '^09[0-9]{9}$'
       LIMIT 1;
    END IF;

    IF cid IS NULL AND phone ~ '^09[0-9]{9}$' THEN
      SELECT count(*) INTO matches FROM customer
       WHERE public.normalize_ph_phone(contact_number) = phone;
      IF matches = 1 THEN
        SELECT id INTO cid FROM customer
         WHERE public.normalize_ph_phone(contact_number) = phone;
      END IF;
    END IF;

    IF cid IS NULL THEN
      INSERT INTO customer (full_name, contact_number, email, psid, created_at)
      VALUES (r.full_name,
              CASE WHEN phone ~ '^09[0-9]{9}$' THEN phone ELSE r.contact_number END,
              r.email,
              CASE WHEN r.psid IS NOT NULL
                        AND NOT EXISTS (SELECT 1 FROM customer WHERE psid = r.psid)
                   THEN r.psid END,
              r.created_at)
      RETURNING id INTO cid;
    END IF;

    UPDATE customer_record SET customer_id = cid WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE customer_record ALTER COLUMN customer_id SET NOT NULL;

DROP INDEX IF EXISTS idx_customer_record_psid;
DROP INDEX IF EXISTS idx_customer_record_notify_psid;

ALTER TABLE customer_record
  DROP COLUMN IF EXISTS full_name,
  DROP COLUMN IF EXISTS contact_number,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS psid,
  DROP COLUMN IF EXISTS notify_psid;
