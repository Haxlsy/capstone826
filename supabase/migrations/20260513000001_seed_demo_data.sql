-- =================================================================
-- SEED: DEMO DATA
-- 19 customer records, 19 historical (Released) job orders,
-- 4 demo job orders for 2026-05-13, 5 concerns (3 Pending, 2 Resolved)
-- =================================================================

-- -----------------------------------------------------------------
-- SECTION 1 — Customer Records (19)
-- -----------------------------------------------------------------

INSERT INTO customer_record (full_name, contact_number, plate_number, vehicle_unit) VALUES
  ('Eve Lumina',        '09170000001', 'EVE 0001', 'Toyota Vios'),
  ('Noah Valor',        '09170000002', 'NOA 0002', 'Honda Civic'),
  ('Abraham Orion',     '09170000003', 'ABR 0003', 'Mitsubishi Montero'),
  ('Sarah Celestine',   '09170000004', 'SAR 0004', 'Toyota Fortuner'),
  ('Isaac Draven',      '09170000005', 'ISA 0005', 'Ford Ranger'),
  ('Jacob Evernight',   '09170000006', 'JAC 0006', 'Hyundai Tucson'),
  ('Joseph Stormborn',  '09170000007', 'JOS 0007', 'Nissan Navara'),
  ('Moses Frostvale',   '09170000008', 'MOS 0008', 'Chevrolet Trailblazer'),
  ('Aaron Nightshade',  '09170000009', 'AAR 0009', 'Toyota Innova'),
  ('David Silverthorn', '09170000010', 'DAV 0010', 'Mazda CX-5'),
  ('Solomon Embercrest','09170000011', 'SOL 0011', 'Suzuki Ertiga'),
  ('Elijah Shadowmere', '09170000012', 'ELI 0012', 'Ford Everest'),
  ('Daniel Moonveil',   '09170000013', 'DAN 0013', 'Kia Sportage'),
  ('Esther Starwhisper','09170000014', 'EST 0014', 'Honda CR-V'),
  ('Mary Dawnfire',     '09170000015', 'MAR 0015', 'Toyota RAV4'),
  ('John Ironwood',     '09170000016', 'JOH 0016', 'Isuzu D-Max'),
  ('Peter Wildthorne',  '09170000017', 'PET 0017', 'Mitsubishi Xpander'),
  ('Paul Brightforge',  '09170000018', 'PAU 0018', 'Subaru Forester'),
  ('Ruth Wintermere',   '09170000019', 'RUT 0019', 'Toyota Avanza')
ON CONFLICT (plate_number) DO NOTHING;

-- -----------------------------------------------------------------
-- SECTION 2 — Historical Job Orders (Released, May 1–11 2026)
-- Service IDs are resolved dynamically to avoid hardcoded UUIDs.
-- COALESCE ensures fallback to OFFSET 0 if fewer than N services exist.
-- -----------------------------------------------------------------

INSERT INTO job_order (customer_record_id, service_id, status, scheduled_at, actual_start_at, expected_completion_at) VALUES
  -- May 1 — customers 1, 2
  (
    (SELECT id FROM customer_record WHERE plate_number = 'EVE 0001'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-01 01:00:00+00', '2026-05-01 01:00:00+00', '2026-05-01 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'NOA 0002'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-01 01:00:00+00', '2026-05-01 01:00:00+00', '2026-05-01 09:00:00+00'
  ),
  -- May 2 — customers 3, 4
  (
    (SELECT id FROM customer_record WHERE plate_number = 'ABR 0003'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-02 01:00:00+00', '2026-05-02 01:00:00+00', '2026-05-02 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'SAR 0004'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 3),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-02 01:00:00+00', '2026-05-02 01:00:00+00', '2026-05-02 09:00:00+00'
  ),
  -- May 3 — customers 5, 6
  (
    (SELECT id FROM customer_record WHERE plate_number = 'ISA 0005'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-03 01:00:00+00', '2026-05-03 01:00:00+00', '2026-05-03 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'JAC 0006'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-03 01:00:00+00', '2026-05-03 01:00:00+00', '2026-05-03 09:00:00+00'
  ),
  -- May 5 — customers 7, 8
  (
    (SELECT id FROM customer_record WHERE plate_number = 'JOS 0007'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-05 01:00:00+00', '2026-05-05 01:00:00+00', '2026-05-05 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'MOS 0008'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 3),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-05 01:00:00+00', '2026-05-05 01:00:00+00', '2026-05-05 09:00:00+00'
  ),
  -- May 6 — customers 9, 10
  (
    (SELECT id FROM customer_record WHERE plate_number = 'AAR 0009'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-06 01:00:00+00', '2026-05-06 01:00:00+00', '2026-05-06 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'DAV 0010'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-06 01:00:00+00', '2026-05-06 01:00:00+00', '2026-05-06 09:00:00+00'
  ),
  -- May 7 — customers 11, 12
  (
    (SELECT id FROM customer_record WHERE plate_number = 'SOL 0011'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-07 01:00:00+00', '2026-05-07 01:00:00+00', '2026-05-07 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'ELI 0012'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 3),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-07 01:00:00+00', '2026-05-07 01:00:00+00', '2026-05-07 09:00:00+00'
  ),
  -- May 8 — customers 13, 14
  (
    (SELECT id FROM customer_record WHERE plate_number = 'DAN 0013'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-08 01:00:00+00', '2026-05-08 01:00:00+00', '2026-05-08 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'EST 0014'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-08 01:00:00+00', '2026-05-08 01:00:00+00', '2026-05-08 09:00:00+00'
  ),
  -- May 9 — customers 15, 16
  (
    (SELECT id FROM customer_record WHERE plate_number = 'MAR 0015'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-09 01:00:00+00', '2026-05-09 01:00:00+00', '2026-05-09 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'JOH 0016'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 3),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-09 01:00:00+00', '2026-05-09 01:00:00+00', '2026-05-09 09:00:00+00'
  ),
  -- May 10 — customers 17, 18
  (
    (SELECT id FROM customer_record WHERE plate_number = 'PET 0017'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-10 01:00:00+00', '2026-05-10 01:00:00+00', '2026-05-10 09:00:00+00'
  ),
  (
    (SELECT id FROM customer_record WHERE plate_number = 'PAU 0018'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-10 01:00:00+00', '2026-05-10 01:00:00+00', '2026-05-10 09:00:00+00'
  ),
  -- May 11 — customer 19
  (
    (SELECT id FROM customer_record WHERE plate_number = 'RUT 0019'),
    COALESCE((SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),(SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)),
    'Released', '2026-05-11 01:00:00+00', '2026-05-11 01:00:00+00', '2026-05-11 09:00:00+00'
  );

-- Mark all stage progress for historical jobs as 'done'
UPDATE job_stage_progress jsp
SET    status       = 'done',
       completed_at = jo.scheduled_at
FROM   job_order jo
WHERE  jsp.job_order_id = jo.id
  AND  jo.status = 'Released';

-- Record status history for historical jobs
INSERT INTO job_order_history (job_order_id, status)
SELECT jo.id, 'Released'
FROM   job_order jo
WHERE  jo.status = 'Released';

-- -----------------------------------------------------------------
-- SECTION 3 — Demo Job Orders for 2026-05-13 (09:00 PHT = 01:00 UTC)
-- -----------------------------------------------------------------

DO $$
DECLARE
  v_job1 UUID;  -- Eve Lumina     — Ongoing
  v_job2 UUID;  -- Noah Valor     — For Release
  v_job3 UUID;  -- Abraham Orion  — Delayed
  v_job4 UUID;  -- Sarah Celestine — Pending
BEGIN

  -- ---------------------------------------------------------------
  -- Job 1: Eve Lumina — Ongoing
  -- All stages done; last stage (highest sequence_order) → in_progress
  -- ---------------------------------------------------------------
  INSERT INTO job_order (
    customer_record_id, service_id, status,
    scheduled_at, actual_start_at
  )
  VALUES (
    (SELECT id FROM customer_record WHERE plate_number = 'EVE 0001'),
    COALESCE(
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 0),
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)
    ),
    'Ongoing',
    '2026-05-13 01:00:00+00',
    '2026-05-13 01:00:00+00'
  )
  RETURNING id INTO v_job1;

  -- Mark all stages done first
  UPDATE job_stage_progress
  SET    status = 'done', completed_at = now()
  WHERE  job_order_id = v_job1;

  -- Override the last stage (highest sequence_order) back to in_progress
  UPDATE job_stage_progress
  SET    status = 'in_progress', completed_at = NULL
  WHERE  job_order_id = v_job1
    AND  service_stage_id = (
      SELECT ss.id
      FROM   service_stage ss
      JOIN   job_stage_progress jsp ON jsp.service_stage_id = ss.id
      WHERE  jsp.job_order_id = v_job1
      ORDER  BY ss.sequence_order DESC
      LIMIT  1
    );

  -- ---------------------------------------------------------------
  -- Job 2: Noah Valor — For Release
  -- All stages done (ready to hand off)
  -- ---------------------------------------------------------------
  INSERT INTO job_order (
    customer_record_id, service_id, status,
    scheduled_at, actual_start_at
  )
  VALUES (
    (SELECT id FROM customer_record WHERE plate_number = 'NOA 0002'),
    COALESCE(
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 1),
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)
    ),
    'For Release',
    '2026-05-13 01:00:00+00',
    '2026-05-13 01:00:00+00'
  )
  RETURNING id INTO v_job2;

  UPDATE job_stage_progress
  SET    status = 'done', completed_at = now()
  WHERE  job_order_id = v_job2;

  -- ---------------------------------------------------------------
  -- Job 3: Abraham Orion — Delayed
  -- First stage (lowest sequence_order) → in_progress; rest stay pending
  -- ---------------------------------------------------------------
  INSERT INTO job_order (
    customer_record_id, service_id, status,
    scheduled_at, actual_start_at
  )
  VALUES (
    (SELECT id FROM customer_record WHERE plate_number = 'ABR 0003'),
    COALESCE(
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 2),
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)
    ),
    'Delayed',
    '2026-05-13 01:00:00+00',
    '2026-05-13 01:00:00+00'
  )
  RETURNING id INTO v_job3;

  UPDATE job_stage_progress
  SET    status = 'in_progress'
  WHERE  job_order_id = v_job3
    AND  service_stage_id = (
      SELECT ss.id
      FROM   service_stage ss
      JOIN   job_stage_progress jsp ON jsp.service_stage_id = ss.id
      WHERE  jsp.job_order_id = v_job3
      ORDER  BY ss.sequence_order ASC
      LIMIT  1
    );

  -- ---------------------------------------------------------------
  -- Job 4: Sarah Celestine — Pending
  -- Trigger auto-creates all stages as 'pending' — no further update needed
  -- ---------------------------------------------------------------
  INSERT INTO job_order (
    customer_record_id, service_id, status,
    scheduled_at
  )
  VALUES (
    (SELECT id FROM customer_record WHERE plate_number = 'SAR 0004'),
    COALESCE(
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1 OFFSET 3),
      (SELECT id FROM service WHERE is_archived = false ORDER BY created_at LIMIT 1)
    ),
    'Pending',
    '2026-05-13 01:00:00+00'
  )
  RETURNING id INTO v_job4;

END;
$$;

-- -----------------------------------------------------------------
-- SECTION 4 — Concerns
-- submitted_by_id: head_detailer/head_installer (fallback: any user)
-- -----------------------------------------------------------------

-- 3 Pending concerns — linked to tomorrow's demo jobs
INSERT INTO concern (job_order_id, submitted_by_id, title, description, status) VALUES

  -- Concern 1: Job 1 (Eve Lumina / Ongoing)
  (
    (
      SELECT jo.id
      FROM   job_order jo
      JOIN   customer_record cr ON cr.id = jo.customer_record_id
      WHERE  cr.plate_number = 'EVE 0001'
        AND  jo.scheduled_at = '2026-05-13 01:00:00+00'
      LIMIT  1
    ),
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('head_detailer','head_installer') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    ),
    'Paint bubble found',
    'Noticed a bubble forming near the hood during the coating application stage. Needs re-inspection before proceeding to the next step.',
    'Pending'
  ),

  -- Concern 2: Job 3 (Abraham Orion / Delayed)
  (
    (
      SELECT jo.id
      FROM   job_order jo
      JOIN   customer_record cr ON cr.id = jo.customer_record_id
      WHERE  cr.plate_number = 'ABR 0003'
        AND  jo.scheduled_at = '2026-05-13 01:00:00+00'
      LIMIT  1
    ),
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('head_detailer','head_installer') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    ),
    'Client requested scope change',
    'Customer called to add side mirror wrap on top of the original service package. Work is paused and awaiting operations approval before continuing.',
    'Pending'
  ),

  -- Concern 3: Job 2 (Noah Valor / For Release)
  (
    (
      SELECT jo.id
      FROM   job_order jo
      JOIN   customer_record cr ON cr.id = jo.customer_record_id
      WHERE  cr.plate_number = 'NOA 0002'
        AND  jo.scheduled_at = '2026-05-13 01:00:00+00'
      LIMIT  1
    ),
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('head_detailer','head_installer') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    ),
    'Surface scratch flagged',
    'A small scratch was found on the rear bumper just before release. Operations should verify the area before handing the vehicle back to the customer.',
    'Pending'
  );

-- 2 Resolved concerns — linked to past historical jobs
INSERT INTO concern (job_order_id, submitted_by_id, title, description, status, response_note, resolved_at, resolved_by_id) VALUES

  -- Resolved 1: Isaac Draven (ISA 0005, May 3 job)
  (
    (
      SELECT jo.id
      FROM   job_order jo
      JOIN   customer_record cr ON cr.id = jo.customer_record_id
      WHERE  cr.plate_number = 'ISA 0005'
      ORDER  BY jo.created_at
      LIMIT  1
    ),
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('head_detailer','head_installer') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    ),
    'Missing touch-up on door panel',
    'Small area near the driver-side door was missed during the finishing stage. Reported before vehicle was released.',
    'Resolved',
    'Operations confirmed the touch-up was completed by the detailing team. Vehicle released to customer.',
    now() - interval '5 days',
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('operations','admin','super_admin') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    )
  ),

  -- Resolved 2: Aaron Nightshade (AAR 0009, May 6 job)
  (
    (
      SELECT jo.id
      FROM   job_order jo
      JOIN   customer_record cr ON cr.id = jo.customer_record_id
      WHERE  cr.plate_number = 'AAR 0009'
      ORDER  BY jo.created_at
      LIMIT  1
    ),
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('head_detailer','head_installer') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    ),
    'Wrong tint grade applied',
    'Installer noticed that the tint grade used did not match the grade specified in the job order. Escalated immediately.',
    'Resolved',
    'Incorrect tint was removed and reapplied with the correct grade. Corrected before vehicle was released to the customer.',
    now() - interval '2 days',
    COALESCE(
      (SELECT id FROM user_account WHERE role IN ('operations','admin','super_admin') AND is_archived = false ORDER BY created_at LIMIT 1),
      (SELECT id FROM user_account ORDER BY created_at LIMIT 1)
    )
  );

-- =================================================================
-- END OF SEED
-- =================================================================
