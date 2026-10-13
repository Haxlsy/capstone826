import { findDuplicateStageIds } from "@/lib/admin/service-stage-validation"

/**
 * Rules for the stages of one job order, as edited in the Service Override
 * panel when the job is created. The same three rules, with the same wording,
 * that Admin's Add/Edit Service forms apply to a service's own stages: the
 * override never had them, so a stage added for a job could be saved with no
 * name and 0 minutes. A 0-minute stage gets no expected end, so it can never
 * show as delayed and adds nothing to the job's estimated completion.
 *
 * Pure, and used by both the form (per-stage feedback) and the API route (the
 * authoritative check, which also covers job orders queued offline).
 */

export interface JobStageInput {
  id: string
  name: string | null | undefined
  stage_duration_mins: number | null | undefined
}

export const STAGE_NAME_REQUIRED = "Stage name cannot be empty."
export const STAGE_NAME_DUPLICATE = "Another stage already has this name."
export const STAGE_DURATION_TOO_SHORT = "Duration must be at least 1 minute."

/** One message per invalid stage id; empty when every stage is fine. A name problem is reported before a duration problem. */
export function validateJobStages(stages: JobStageInput[]): Record<string, string> {
  const duplicates = findDuplicateStageIds(stages.map((s) => ({ id: s.id, name: s.name ?? "" })))
  const problems: Record<string, string> = {}
  for (const s of stages) {
    const duration = s.stage_duration_mins
    if (!(s.name ?? "").trim()) problems[s.id] = STAGE_NAME_REQUIRED
    else if (duplicates.has(s.id)) problems[s.id] = STAGE_NAME_DUPLICATE
    else if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 1) {
      problems[s.id] = STAGE_DURATION_TOO_SHORT
    }
  }
  return problems
}
