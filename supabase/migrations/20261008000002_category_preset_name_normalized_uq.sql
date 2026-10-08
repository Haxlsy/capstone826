-- Category Preset names were never protected against case/whitespace
-- duplicates — same gap service and service_type both already had before
-- their own normalized unique indexes fixed it. Mirrors that approach:
-- uniqueness on the normalized form (case-insensitive, space-insensitive)
-- so "Installer Triplet", "installer triplet", and "Installer  Triplet"
-- all collide.
--
-- If this fails to apply, the live `category_preset` table already has a
-- duplicate (or near-duplicate) name — find it with:
--   SELECT LOWER(REGEXP_REPLACE(name, '\s+', '', 'g')) AS normalized, array_agg(name), array_agg(id)
--   FROM category_preset GROUP BY 1 HAVING COUNT(*) > 1;
-- and rename/merge the duplicates before re-running this migration.
CREATE UNIQUE INDEX IF NOT EXISTS category_preset_name_normalized_uq
  ON category_preset (LOWER(REGEXP_REPLACE(name, '\s+', '', 'g')));
