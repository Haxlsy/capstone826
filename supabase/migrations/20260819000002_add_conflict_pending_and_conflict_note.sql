-- Phase 4: identity-conflict handling (Test 5).
--
-- conflict_pending: set when the AI has surfaced an identity conflict on a
--   complete booking and asked the customer to clarify it, so the next turn
--   knows a conflict was already raised (vs. a fresh detection).
ALTER TABLE messenger_conversation
  ADD COLUMN IF NOT EXISTS conflict_pending boolean NOT NULL DEFAULT false;

-- conflict_note: recorded on the inquiry when a conflicting booking is
--   escalated, so Sales can see why the booking needs identity verification.
ALTER TABLE inquiry
  ADD COLUMN IF NOT EXISTS conflict_note text;
