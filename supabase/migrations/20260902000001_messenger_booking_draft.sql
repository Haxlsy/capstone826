-- Booking-flow draft: the details collected so far in the CURRENT booking
-- attempt, persisted so a later Gemini extraction that omits a field cannot
-- regress the flow. Merged each turn (a non-null extracted value wins; a null
-- keeps the stored value). Cleared on escalation / wander-off / duplicate-ack /
-- vehicle-in-service / flow reset.
ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS draft_name    text,
  ADD COLUMN IF NOT EXISTS draft_contact text,
  ADD COLUMN IF NOT EXISTS draft_plate   text,
  ADD COLUMN IF NOT EXISTS draft_vehicle text,
  ADD COLUMN IF NOT EXISTS draft_email   text;

NOTIFY pgrst, 'reload schema';
