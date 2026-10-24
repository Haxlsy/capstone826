export interface StageProgress {
  status: string
  current_rework_round?: number | null
}

/**
 * The job status to move to after a stage is marked done, or `null` to leave
 * it. Only a job in "For Rework" moves:
 *
 * - every stage done → "For Inspection" (rework finished, ready to inspect)
 * - stages left, but none of them is still being reworked → "Ongoing": a head
 *   technician's mid-job rework is finished and normal work continues
 * - a stage is still being reworked → stay "For Rework"
 *
 * A stage is "still being reworked" when it isn't done and either is flagged
 * `for_rework` (Operations) or has started a rework round (head technician's
 * own rework puts it back `in_progress` with the round bumped).
 */
export function jobStatusAfterStageDone({
  currentStatus,
  stages,
}: {
  currentStatus: string | null | undefined
  stages: StageProgress[]
}): "For Inspection" | "Ongoing" | null {
  if (currentStatus !== "For Rework") return null
  const notDone = stages.filter((s) => s.status !== "done")
  if (notDone.length === 0) return "For Inspection"
  const stillInRework = notDone.some(
    (s) => s.status === "for_rework" || (s.current_rework_round ?? 0) > 0,
  )
  return stillInRework ? null : "Ongoing"
}
