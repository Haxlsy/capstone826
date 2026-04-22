-- =================================================================
-- ADD FINISHING STAGE CATEGORY
-- Adds 'finishing' as a valid service_stage_category so detailers
-- can perform post-installation finishing stages before release.
-- =================================================================

ALTER TYPE service_stage_category ADD VALUE IF NOT EXISTS 'finishing';
