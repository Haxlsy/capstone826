-- Tracks whether the AI has informed a returning customer (identified by psid)
-- that they already have an active booking on file. The webhook consults this
-- flag so the inform+pause message is shown once per booking attempt, and a
-- later "yes / book another" reply releases the pause to collect a separate new
-- booking instead of re-informing endlessly.

ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS active_booking_offered boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';