-- Service names were never protected against duplicates — same gap
-- service_type already had before 20260501000002_add_service_type_table.sql
-- fixed it there. Mirrors that exact approach: uniqueness on the normalized
-- form (case-insensitive, space-insensitive) so "Ceramic Coating",
-- "ceramic coating", and "ceramiccoating" all collide.
--
-- If this fails to apply, the live `service` table already has a duplicate
-- (or near-duplicate) name — find it with:
--   SELECT LOWER(REGEXP_REPLACE(name, '\s+', '', 'g')) AS normalized, array_agg(name), array_agg(id)
--   FROM service GROUP BY 1 HAVING COUNT(*) > 1;
-- and rename/merge the duplicates before re-running this migration.
CREATE UNIQUE INDEX IF NOT EXISTS service_name_normalized_uq
  ON service (LOWER(REGEXP_REPLACE(name, '\s+', '', 'g')));
