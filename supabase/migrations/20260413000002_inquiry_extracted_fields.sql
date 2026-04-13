-- Add chatbot-extracted customer fields to the inquiry table.
-- These are populated by the Messenger webhook when the chatbot collects
-- booking details, so Sales can see them when recording the customer.

ALTER TABLE inquiry
  ADD COLUMN IF NOT EXISTS extracted_name    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS extracted_contact VARCHAR(20),
  ADD COLUMN IF NOT EXISTS extracted_plate   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS extracted_vehicle VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_message      TEXT;
