import type { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES, stageDelayedSince, type StageRowForDelay } from "@/lib/job-delay"
import { loadWorkSchedule } from "@/lib/operating-hours"

/**
 * The stage-level half of "is this job delayed", loaded for a list of jobs:
 * a map of job id to when it first fell behind, for every started, active job
 * with a stage past its expected end (see stageDelayedSince in
 * lib/job-delay.ts). Jobs that are on time are absent from the map.
 *
 * Every list that shows a job-level Delayed badge, tab or count combines this
 * with isJobDelayed. They used to check only the job's estimated completion,
 * so a job could show a Delayed stage under an "Ongoing" badge.
 *
 * Server only. Never throws: a failed query reads as "no stage delays", which
 * leaves the job-level check standing on its own.
 */
export async function loadStageDelayedSince(
  admin: ReturnType<typeof createAdminClient>,
  jobs: { id: string; status: string; actual_start_at: string | null }[],
): Promise<Map<string, string>> {
  const started = jobs.filter(
    (j) => (ACTIVE_JOB_STATUSES as readonly string[]).includes(j.status) && j.actual_start_at,
  )
  if (started.length === 0) return new Map()

  const [{ data, error }, schedule] = await Promise.all([
    admin
      .from("job_stage_progress")
      .select("job_order_id, status, stage_duration_mins, service_stage:service_stage_id(stage_duration_mins, sequence_order)")
      .in("job_order_id", started.map((j) => j.id)),
    loadWorkSchedule(admin),
  ])
  if (error) {
    console.error("[job-delay] stage delay query failed:", error.message)
    return new Map()
  }

  return stageDelayedSince(
    (data ?? []) as unknown as StageRowForDelay[],
    new Map(started.map((j) => [j.id, j.actual_start_at])),
    schedule,
  )
}
