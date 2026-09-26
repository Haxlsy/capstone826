-- =====================================================================
-- Run in Supabase -> SQL Editor BEFORE
-- supabase/migrations/20260926000002_customer_table.sql and look at what
-- the automatic grouping will do. It changes NO data (it only creates
-- the small phone-normalising helper the migration also creates).
-- (Open this file and copy from it; long lines get clipped in chat.)
-- =====================================================================

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

-- 1) Same phone but different names / emails: the migration puts these
--    rows in ONE customer (name/email from the Messenger-linked row,
--    else the oldest). Check none of these are really different people.
SELECT public.normalize_ph_phone(contact_number) AS phone,
       count(*)                                  AS vehicles,
       array_agg(DISTINCT full_name)             AS names,
       array_agg(DISTINCT email)                 AS emails
  FROM customer_record
 WHERE public.normalize_ph_phone(contact_number) ~ '^09[0-9]{9}$'
 GROUP BY 1
HAVING count(DISTINCT lower(trim(full_name))) > 1
    OR count(DISTINCT lower(trim(email))) > 1
 ORDER BY vehicles DESC;

-- 2) Same phone, more than one Messenger-linked row: these stay SEPARATE
--    customers (a psid is unique per customer) - the rows without a psid
--    then get their own customer per phone.
SELECT public.normalize_ph_phone(contact_number) AS phone,
       array_agg(plate_number)                   AS plates,
       array_agg(psid)                           AS psids
  FROM customer_record
 WHERE psid IS NOT NULL
   AND public.normalize_ph_phone(contact_number) ~ '^09[0-9]{9}$'
 GROUP BY 1
HAVING count(*) > 1;

-- 3) Vehicles booked for someone else (notify_psid on a different phone):
--    they become their own customer with a "booked by" link.
SELECT b.plate_number, b.full_name AS booked_for, b.contact_number,
       a.full_name AS booked_by, a.contact_number AS booker_phone
  FROM customer_record b
  JOIN customer_record a ON a.psid = b.notify_psid
 WHERE b.psid IS NULL
   AND public.normalize_ph_phone(b.contact_number)
       <> public.normalize_ph_phone(a.contact_number);

-- 4) Rows whose phone is not a plausible PH mobile: each becomes its own
--    customer (never merged by phone).
SELECT plate_number, full_name, contact_number
  FROM customer_record
 WHERE NOT (public.normalize_ph_phone(contact_number) ~ '^09[0-9]{9}$');
