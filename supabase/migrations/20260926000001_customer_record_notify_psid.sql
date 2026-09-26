-- =================================================================
-- customer_record.notify_psid — the Messenger account that gets a
-- vehicle's job updates when the record can't hold the psid itself.
--
-- customer_record.psid is UNIQUE, so a customer's 2nd vehicle (or a
-- booking under a different name/number recorded from the same
-- Messenger conversation) is saved with psid = NULL. Job updates read
-- the psid from the job's own record, so those vehicles never got any
-- update. notify_psid is NOT unique and is only used as the fallback
-- recipient (lib/messenger/recipient.ts).
-- =================================================================

ALTER TABLE customer_record
  ADD COLUMN IF NOT EXISTS notify_psid VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_customer_record_notify_psid
  ON customer_record (notify_psid);

-- -----------------------------------------------------------------
-- OPTIONAL one-time backfill for bookings Sales already recorded:
-- a record with no psid of its own gets the psid of the (recorded)
-- Messenger inquiry whose plate matches. Fills NULLs only; safe to
-- re-run. Review with the SELECT below first if you like.
-- -----------------------------------------------------------------
--   SELECT cr.plate_number, i.psid
--     FROM customer_record cr
--     JOIN inquiry i ON i.status = 'recorded'
--      AND upper(regexp_replace(i.extracted_plate, '\s', '', 'g'))
--        = upper(regexp_replace(cr.plate_number,  '\s', '', 'g'))
--    WHERE cr.psid IS NULL AND cr.notify_psid IS NULL;

UPDATE customer_record cr
   SET notify_psid = m.psid
  FROM (
    SELECT DISTINCT ON (upper(regexp_replace(i.extracted_plate, '\s', '', 'g')))
           upper(regexp_replace(i.extracted_plate, '\s', '', 'g')) AS plate_key,
           i.psid
      FROM inquiry i
     WHERE i.status = 'recorded'
       AND i.psid IS NOT NULL
       AND i.extracted_plate IS NOT NULL
     ORDER BY upper(regexp_replace(i.extracted_plate, '\s', '', 'g')),
              i.escalated_at DESC NULLS LAST
  ) m
 WHERE cr.psid IS NULL
   AND cr.notify_psid IS NULL
   AND upper(regexp_replace(cr.plate_number, '\s', '', 'g')) = m.plate_key;
