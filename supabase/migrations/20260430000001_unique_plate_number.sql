-- Migration: enforce 1-to-1 plate number → customer_record relationship
-- Step 1: Re-point any job_orders that reference duplicate customer_records
--         to the oldest (earliest created_at) record for that plate.
WITH ranked AS (
  SELECT id, plate_number,
    ROW_NUMBER() OVER (PARTITION BY plate_number ORDER BY created_at, id) AS rn
  FROM customer_record
),
kept AS (
  SELECT plate_number, id AS keep_id FROM ranked WHERE rn = 1
),
removed AS (
  SELECT r.id AS remove_id, k.keep_id
  FROM ranked r
  JOIN kept k ON r.plate_number = k.plate_number
  WHERE r.rn > 1
)
UPDATE job_order
SET customer_record_id = removed.keep_id
FROM removed
WHERE job_order.customer_record_id = removed.remove_id;

-- Step 2: Delete the now-unreferenced duplicate customer_records.
DELETE FROM customer_record
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY plate_number ORDER BY created_at, id) AS rn
    FROM customer_record
  ) ranked
  WHERE rn > 1
);

-- Step 3: Enforce uniqueness going forward.
ALTER TABLE customer_record
  ADD CONSTRAINT customer_record_plate_number_key UNIQUE (plate_number);
