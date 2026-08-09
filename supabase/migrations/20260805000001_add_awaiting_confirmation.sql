-- Tracks whether the AI has asked the customer to confirm their collected
-- booking details. The webhook consults this flag so a later free-text message
-- (even one with no booking details) still lands on the confirmation step
-- instead of being treated as an unrelated chat.

ALTER TABLE public.messenger_conversation
  ADD COLUMN IF NOT EXISTS awaiting_confirmation boolean NOT NULL DEFAULT false;

-- Refresh the PostgREST schema cache so the webhook can select/update the new
-- column immediately after the migration is applied.
NOTIFY pgrst, 'reload schema';