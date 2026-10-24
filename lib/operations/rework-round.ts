import type { createAdminClient } from "@/lib/supabase/admin"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Starts a new rework round on each stage: bumps `current_rework_round` and
 * applies `fields` (status, rework instructions, cleared completion, ...).
 *
 * The bump is what locks the previous round's photos/videos: uploads are
 * tagged with the round they were made in, and only the current round's media
 * can be removed (media route DELETE + HeadTechJobHistoryPage). It also gives
 * the redo its own upload allowance and keeps it out of the customer-facing
 * round-0 set. Every path that sends a stage back for rework must go through
 * here so they can't drift apart again.
 *
 * Each stage is bumped from its own current round. Returns the first error.
 */
export async function startReworkRound(
  admin: AdminClient,
  jobId: string,
  stageIds: string[],
  fields: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  if (stageIds.length === 0) return { error: null }

  const { data: rows, error: readError } = await admin
    .from("job_stage_progress")
    .select("id, current_rework_round")
    .in("id", stageIds)
    .eq("job_order_id", jobId)
  if (readError) return { error: readError }

  const results = await Promise.all(
    ((rows ?? []) as { id: string; current_rework_round: number | null }[]).map((row) =>
      admin
        .from("job_stage_progress")
        .update({ ...fields, current_rework_round: (row.current_rework_round ?? 0) + 1 })
        .eq("id", row.id)
        .eq("job_order_id", jobId),
    ),
  )
  const failed = results.find((r) => r.error)
  return { error: failed?.error ?? null }
}
