-- Lets a substitute (crew or head technician) be safely removed without any
-- risk of ever deleting an original assignment. job_order_team previously had
-- no way to tell "the original assignment" apart from "a substitute added
-- later" — for crew (detailer/installer) both land in the same flat list
-- with no timestamp/sequence column, and deriving it from row order isn't a
-- real guarantee. This column is the explicit, permanent distinction: only
-- app/api/operations/job-orders/[id]/add-substitute/route.ts's POST ever
-- sets it true; every existing row (and every future original-assignment
-- insert from add-job-order) defaults to false. The DELETE handler on that
-- same route requires is_substitute = true, so it's structurally impossible
-- to remove an original assignment even given a wrong id.
ALTER TABLE job_order_team
  ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN NOT NULL DEFAULT false;
