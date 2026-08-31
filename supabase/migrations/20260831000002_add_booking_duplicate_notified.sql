-- Tracks whether the AI has already told a returning customer (identified by
-- psid) that we have their booking on file for a vehicle they are re-submitting.
-- The webhook consults this flag so an identical repeat booking is acknowledged
-- once without creating a duplicate inquiry; if the customer submits the same
-- booking again after being told, it is escalated to Sales flagged as a repeat.

ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS booking_duplicate_notified boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
