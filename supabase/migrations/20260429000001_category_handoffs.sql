-- Track explicit per-category handoff approvals on each job order.
-- Prevents the next category's stages from auto-unlocking purely from stage completion.
ALTER TABLE job_order
  ADD COLUMN IF NOT EXISTS category_handoffs JSONB NOT NULL DEFAULT '{}';
