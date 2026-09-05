-- =================================================================
-- Job Order Code — a real, persisted, human-readable job order ID.
--
-- Replaces the ad hoc "JO-{year}-{last 4 chars of the UUID}" display
-- trick computed independently (and inconsistently) in several API
-- routes/components. This column is also now a security-relevant
-- credential: a Messenger customer's own Job Order Code auto-links
-- their PSID to the matching customer record (see lib/messenger/vehicle.ts
-- assessJobOrderLinkClaim), so the code must not be guessable — it is
-- a short RANDOM code, never a sequential one.
--
-- Alphabet excludes 0/O/1/I/L to avoid transcription ambiguity when a
-- customer reads it off a receipt and types it into Messenger.
-- =================================================================

CREATE OR REPLACE FUNCTION generate_job_order_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  END LOOP;
  RETURN 'JO-' || code;
END;
$$;

ALTER TABLE job_order ADD COLUMN IF NOT EXISTS job_order_code VARCHAR(9);

-- Backfill existing rows with a unique code each.
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
BEGIN
  FOR r IN SELECT id FROM public.job_order WHERE job_order_code IS NULL LOOP
    LOOP
      candidate := generate_job_order_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_order WHERE job_order_code = candidate);
    END LOOP;
    UPDATE public.job_order SET job_order_code = candidate WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE job_order ALTER COLUMN job_order_code SET NOT NULL;
ALTER TABLE job_order ADD CONSTRAINT job_order_code_unique UNIQUE (job_order_code);

-- Auto-fill job_order_code on every future insert (retrying on the rare
-- collision), so API routes never need to generate it themselves.
CREATE OR REPLACE FUNCTION set_job_order_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  tries INT := 0;
BEGIN
  IF NEW.job_order_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  LOOP
    candidate := generate_job_order_code();
    tries := tries + 1;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_order WHERE job_order_code = candidate);
    IF tries > 20 THEN
      RAISE EXCEPTION 'Could not generate a unique job_order_code after % tries', tries;
    END IF;
  END LOOP;
  NEW.job_order_code := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_order_code ON public.job_order;

CREATE TRIGGER trg_job_order_code
  BEFORE INSERT ON public.job_order
  FOR EACH ROW EXECUTE FUNCTION set_job_order_code();
