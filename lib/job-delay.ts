import { addWorkingMins, DEFAULT_SCHEDULE, type WorkSchedule } from "@/hooks/time-utils"

/**
 * The single source of truth for "is this job/stage delayed" — every surface
 * that shows a Delayed badge, tab, or count (Admin, Operations, Head
 * Detailer/Installer) computes it via this module instead of re-deriving its
 * own threshold. Before this existed, the predicate was independently
 * re-typed in at least 7 places across the app, each with a slightly
 * different active-status allow-list or date field, and they could (and did)
 * disagree about the same job at the same instant.
 */

/**
 * Job statuses that represent active, unfinished work — the only ones a job
 * can be "running late" while in. A job that hasn't started yet, or is
 * already Released/Cancelled, can't newly become "overdue" by this check.
 */
export const ACTIVE_JOB_STATUSES = ["Pending", "Ongoing", "For Rework", "For Inspection", "For Release"] as const
export type ActiveJobStatus = (typeof ACTIVE_JOB_STATUSES)[number]

/**
 * THE job-level definition of "delayed": it's still actively in progress and
 * has run past its stored `expected_completion_at`. "Delayed" is no longer a
 * status a staff member can set (the status picker and the job-orders PATCH
 * route both reject it) — this computed check is the only source of truth
 * now. `job.status === "Delayed"` is still honored here only for legacy rows
 * that predate that change; it can never be newly true going forward.
 */
export function isJobDelayed(job: {
  status: string
  expected_completion_at: string | null
}): boolean {
  if (job.status === "Delayed") return true
  if (!ACTIVE_JOB_STATUSES.includes(job.status as ActiveJobStatus)) return false
  if (!job.expected_completion_at) return false
  return new Date(job.expected_completion_at).getTime() < Date.now()
}

export interface StageForDelay {
  id: string
  status: string
  sequence_order: number
  /** Per-job override, when one was set for this stage. */
  stage_duration_mins: number | null
  /** The service stage's own default duration, used when no override exists. */
  service_stage_duration_mins: number | null
}

export interface StageDelayResult {
  expected_end_at: string | null
  is_delayed: boolean
}

/**
 * THE per-stage definition of "delayed": walks stages in sequence order from
 * `actualStartAt`, accumulating each stage's expected duration (an override
 * if set, else the service stage's default) via `addWorkingMins`, and flags
 * any incomplete stage (not "done", not "for_rework" — a stage sent back for
 * rework is no longer running against the original clock) whose cumulative
 * expected end has passed. Returns every stage's id mapped to its result,
 * `is_delayed: false` and `expected_end_at: null` for all of them when the
 * job hasn't started yet (nothing to measure against).
 */
export function computeStageDelays(
  stages: StageForDelay[],
  actualStartAt: string | null | undefined,
  schedule: WorkSchedule = DEFAULT_SCHEDULE,
): Map<string, StageDelayResult> {
  const result = new Map<string, StageDelayResult>()
  for (const s of stages) result.set(s.id, { expected_end_at: null, is_delayed: false })
  if (!actualStartAt) return result

  const sorted = [...stages].sort((a, b) => a.sequence_order - b.sequence_order)
  const jobStart = new Date(actualStartAt)
  const nowMs = Date.now()
  let cumulativeMins = 0

  for (const s of sorted) {
    const mins = s.stage_duration_mins ?? s.service_stage_duration_mins ?? 0
    cumulativeMins += mins
    if (mins > 0) {
      const expectedEnd = addWorkingMins(jobStart, cumulativeMins, schedule)
      result.set(s.id, {
        expected_end_at: expectedEnd.toISOString(),
        is_delayed: s.status !== "done" && s.status !== "for_rework" && nowMs > expectedEnd.getTime(),
      })
    }
  }

  return result
}

/** True when at least one stage in the map/list is individually delayed —
 *  the job-level "has a delayed stage" rollup Head Detailer/Installer's job
 *  list card needs. */
export function hasAnyStageDelayed(stageDelays: Map<string, StageDelayResult> | StageDelayResult[]): boolean {
  const values = stageDelays instanceof Map ? [...stageDelays.values()] : stageDelays
  return values.some((v) => v.is_delayed)
}

/** A job_stage_progress row as the dashboards select it. */
export interface StageRowForDelay {
  job_order_id: string
  status: string
  stage_duration_mins: number | null
  service_stage:
    | { stage_duration_mins: number | null; sequence_order: number | null }
    | { stage_duration_mins: number | null; sequence_order: number | null }[]
    | null
}

/**
 * The stage-level half of "is this job delayed", rolled up per job: for each
 * started job with at least one delayed stage (see computeStageDelays), the
 * earliest expected end among those stages, i.e. when the job first fell
 * behind. Jobs with no start time or no late stage are absent from the map.
 *
 * Operations' dashboard and Admin's Delayed Jobs table both call this. Admin
 * used to check only the job-level deadline, so a job with a stage running
 * late showed as delayed for Operations and not at all for Admin.
 */
export function stageDelayedSince(
  stageRows: StageRowForDelay[],
  startByJobId: Map<string, string | null | undefined>,
  schedule: WorkSchedule = DEFAULT_SCHEDULE,
): Map<string, string> {
  const byJob = new Map<string, StageRowForDelay[]>()
  for (const s of stageRows) {
    if (!byJob.has(s.job_order_id)) byJob.set(s.job_order_id, [])
    byJob.get(s.job_order_id)!.push(s)
  }

  const result = new Map<string, string>()
  for (const [jobId, stages] of byJob) {
    const startAt = startByJobId.get(jobId)
    if (!startAt) continue
    const shaped: StageForDelay[] = stages.map((s, idx) => {
      const svc = Array.isArray(s.service_stage) ? s.service_stage[0] : s.service_stage
      return {
        id: String(idx),
        status: s.status,
        sequence_order: svc?.sequence_order ?? 0,
        stage_duration_mins: s.stage_duration_mins,
        service_stage_duration_mins: svc?.stage_duration_mins ?? null,
      }
    })
    const lateEnds = [...computeStageDelays(shaped, startAt, schedule).values()]
      .filter((d) => d.is_delayed && d.expected_end_at)
      .map((d) => d.expected_end_at as string)
      .sort()
    if (lateEnds.length > 0) result.set(jobId, lateEnds[0])
  }
  return result
}

/**
 * What status label to actually show for a job. The real, stored `status`
 * (`Pending`/`Ongoing`/etc.) is left untouched everywhere — other code
 * (allowed-transition checks, "can release" guards) depends on knowing the
 * genuine value — but the DISPLAY should read "Delayed" once `isJobDelayed`
 * says so, even though nothing sets that as the literal stored status
 * anymore. Every surface that renders a status badge/dot for a job order
 * (Admin, Operations, Sales, the Job Calendar) resolves through this instead
 * of inlining the same `status !== "Delayed" && isOverdue ? ...` check.
 *
 * Re-checks `ACTIVE_JOB_STATUSES` itself rather than trusting `isOverdue`
 * blindly — a finished job (Released/Cancelled) never displays as Delayed
 * even if a caller passes a stale or wrongly-computed flag for one.
 */
export function displayJobStatus(status: string, isOverdue: boolean): string {
  if (status === "Delayed") return status
  const isActive = ACTIVE_JOB_STATUSES.includes(status as ActiveJobStatus)
  return isActive && isOverdue ? "Delayed" : status
}
