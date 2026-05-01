-- Dedicated service_type lookup table.
-- Uniqueness is enforced on the normalized form (lowercase + no spaces)
-- so "Nano Ceramic", "nano ceramic", and "nanoceramic" all collide.
CREATE TABLE service_type (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalized uniqueness: case-insensitive + space-insensitive
CREATE UNIQUE INDEX service_type_normalized_uq
  ON service_type (LOWER(REGEXP_REPLACE(name, '\s+', '', 'g')));

-- Seed from existing service rows (deduplicated — picks first alphabetically per group)
INSERT INTO service_type (name)
SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(service_type, '\s+', '', 'g')))
  service_type
FROM service
WHERE service_type IS NOT NULL
  AND service_type <> ''
ORDER BY
  LOWER(REGEXP_REPLACE(service_type, '\s+', '', 'g')),
  service_type
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE service_type ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_type_select" ON service_type FOR SELECT USING (true);
CREATE POLICY "service_type_insert" ON service_type FOR INSERT WITH CHECK (true);
CREATE POLICY "service_type_delete" ON service_type FOR DELETE USING (true);
