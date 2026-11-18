-- One-time clean-up: existing names saved in ALL CAPS or all lowercase are
-- rewritten in the format the app now saves (lib/name.ts):
--   people   "MA CLARA A SANTOS JR" -> "Ma. Clara A. Santos Jr."
--            "juan dela cruz"       -> "Juan Dela Cruz"
--   services "CERAMIC COATING"      -> "Ceramic Coating"
--            "full body ppf"        -> "Full Body PPF"
--
-- Only values that are ENTIRELY upper- or lowercase are touched, so a name
-- someone already wrote with care ("Douglas McArthur") is never changed.
-- Safe to re-run: a formatted value is mixed case and is skipped.
--
-- The helper functions are created in pg_temp, so they disappear when the
-- session ends and nothing is added to the schema.
--
-- To preview first, run only the CREATE FUNCTION statements and the SELECT at
-- the bottom (commented out), then run the whole file.

BEGIN;

-- ── People ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.fmt_person_word(w text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  bare  text := lower(regexp_replace(w, '\.$', ''));
  cased text;
BEGIN
  -- Short forms with a period: Ma. (Maria), Jr., Sr., Sto., Sta.
  IF bare IN ('ma', 'jr', 'sr', 'sto', 'sta') THEN RETURN initcap(bare) || '.'; END IF;
  -- Generational suffixes stay in capitals (V and X are read as initials).
  IF bare IN ('ii', 'iii', 'iv') THEN RETURN upper(bare); END IF;
  -- A single letter is a middle initial: "a" -> "A."
  IF w ~ '^[[:alpha:]]\.?$' THEN RETURN upper(left(w, 1)) || '.'; END IF;
  -- Deliberate mixed case ("McArthur") is kept.
  IF w <> upper(w) AND w <> lower(w) THEN RETURN w; END IF;
  -- initcap capitalises after hyphens and apostrophes too: Mary-Jane, O'Brien.
  cased := initcap(lower(w));
  IF cased ~ '^Mc[[:alpha:]]{2,}' THEN
    cased := 'Mc' || upper(substr(cased, 3, 1)) || substr(cased, 4);
  END IF;
  RETURN cased;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.fmt_person(v text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(pg_temp.fmt_person_word(word), ' ' ORDER BY n)
  FROM regexp_split_to_table(btrim(regexp_replace(v, '\s+', ' ', 'g')), ' ') WITH ORDINALITY AS t(word, n)
  WHERE word <> ''
$$;

-- ── Services ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.fmt_service(v text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  words text[] := regexp_split_to_array(btrim(regexp_replace(v, '\s+', ' ', 'g')), ' ');
  out   text[] := '{}';
  w     text;
  lw    text;
  i     int := 0;
BEGIN
  FOREACH w IN ARRAY words LOOP
    i := i + 1;
    lw := lower(w);
    IF lw IN ('ppf', 'suv', 'auv', 'uv', 'ir', 'ac', 'led', 'hid', 'oem', 'diy', 'pdr', 'cr') THEN
      out := out || upper(w);                       -- shop acronyms
    ELSIF w ~ '[0-9]' THEN
      out := out || w;                              -- codes like F1, 9H
    ELSIF w <> upper(w) AND w <> lower(w) THEN
      out := out || w;                              -- deliberate mixed case
    ELSIF i > 1 AND lw IN ('and', 'or', 'of', 'with', 'for', 'the', 'in', 'on', 'to', '&') THEN
      out := out || lw;                             -- "Wash and Wax"
    ELSE
      out := out || initcap(lw);
    END IF;
  END LOOP;
  RETURN array_to_string(out, ' ');
END $$;

-- Whole value is one case only (the ones that need fixing).
CREATE OR REPLACE FUNCTION pg_temp.needs_fix(v text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NOT NULL AND btrim(v) <> '' AND (v = upper(v) OR v = lower(v))
$$;

-- ── Preview (optional): uncomment and run with the functions above ──────────
-- SELECT 'customer' AS tbl, full_name AS before, pg_temp.fmt_person(full_name) AS after
--   FROM customer WHERE pg_temp.needs_fix(full_name)
-- UNION ALL SELECT 'account', full_name, pg_temp.fmt_person(full_name) FROM user_account WHERE pg_temp.needs_fix(full_name)
-- UNION ALL SELECT 'technician', full_name, pg_temp.fmt_person(full_name) FROM technician WHERE pg_temp.needs_fix(full_name)
-- UNION ALL SELECT 'service', name, pg_temp.fmt_service(name) FROM service WHERE pg_temp.needs_fix(name)
-- UNION ALL SELECT 'stage', name, pg_temp.fmt_service(name) FROM service_stage WHERE pg_temp.needs_fix(name);

-- ── People ───────────────────────────────────────────────────────────────────
UPDATE customer SET full_name = pg_temp.fmt_person(full_name) WHERE pg_temp.needs_fix(full_name);

UPDATE user_account SET first_name = pg_temp.fmt_person(first_name) WHERE pg_temp.needs_fix(first_name);
UPDATE user_account SET last_name  = pg_temp.fmt_person(last_name)  WHERE pg_temp.needs_fix(last_name);
UPDATE user_account SET full_name  = pg_temp.fmt_person(full_name)  WHERE pg_temp.needs_fix(full_name);

UPDATE technician SET first_name = pg_temp.fmt_person(first_name) WHERE pg_temp.needs_fix(first_name);
UPDATE technician SET last_name  = pg_temp.fmt_person(last_name)  WHERE pg_temp.needs_fix(last_name);
UPDATE technician SET full_name  = pg_temp.fmt_person(full_name)  WHERE pg_temp.needs_fix(full_name);

UPDATE inquiry SET extracted_name = pg_temp.fmt_person(extracted_name) WHERE pg_temp.needs_fix(extracted_name);
UPDATE job_order SET customer_name = pg_temp.fmt_person(customer_name) WHERE pg_temp.needs_fix(customer_name);
UPDATE messenger_conversation SET draft_name = pg_temp.fmt_person(draft_name) WHERE pg_temp.needs_fix(draft_name);

-- ── Services ─────────────────────────────────────────────────────────────────
UPDATE service SET name = pg_temp.fmt_service(name) WHERE pg_temp.needs_fix(name);
UPDATE service_stage SET name = pg_temp.fmt_service(name) WHERE pg_temp.needs_fix(name);
UPDATE job_stage_progress SET custom_name = pg_temp.fmt_service(custom_name) WHERE pg_temp.needs_fix(custom_name);
-- service.service_type holds a service_type name as plain text: both get the
-- same rule, so they keep matching.
UPDATE service_type SET name = pg_temp.fmt_service(name) WHERE pg_temp.needs_fix(name);
UPDATE service SET service_type = pg_temp.fmt_service(service_type) WHERE pg_temp.needs_fix(service_type);

COMMIT;
