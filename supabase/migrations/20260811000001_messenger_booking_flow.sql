-- Track that a Messenger conversation is mid-booking so the deterministic
-- booking → confirm → escalate flow stays engaged across detail-collection
-- turns (mirrors the existing is_vehicle_inquiry pattern).

ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS is_booking_flow boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
