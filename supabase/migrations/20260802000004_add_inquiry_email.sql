-- Add extracted_email to the inquiry table.
-- The UI and sales API already read inquiry.extracted_email, but the column was
-- never created. This backfills the schema so the chatbot's auto-extracted
-- customer details (which include email) can be stored and surfaced to Sales.

ALTER TABLE inquiry
  ADD COLUMN IF NOT EXISTS extracted_email VARCHAR(255);