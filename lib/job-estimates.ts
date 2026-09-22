import { addWorkingMins, DEFAULT_SCHEDULE, type WorkSchedule } from "@/hooks/time-utils"

type DurationStage = {
  stage_duration_mins?: number | null
  service_stage_id?: string | null
}

type DurationSource = {
  stage_duration_mins: number
}

// Total stage duration in minutes, preferring the per-job override on
// job_stage_progress over the service_stage template value.
export function totalStageDurationMins(
  stages: DurationStage[],
  ssMap: Map<string, DurationSource>
): number {
  return (stages ?? []).reduce((acc, s) => {
    const override = (s.stage_duration_mins as number | null) ?? null
    const service  = s.service_stage_id ? (ssMap.get(s.service_stage_id)?.stage_duration_mins ?? 0) : 0
    return acc + (override !== null ? override : service)
  }, 0)
}

// Expected completion: scheduled_at + total duration (working-hours aware).
// If the job actually started, an updated estimate from actual_start_at is
// returned only when it is later than the scheduled-based estimate.
export function computeExpectedCompletion(
  input: {
    scheduled_at: string | null
    actual_start_at?: string | null
    totalDurationMins: number
  },
  schedule: WorkSchedule = DEFAULT_SCHEDULE,
): { expected: string | null; updated: string | null } {
  const expected = input.scheduled_at
    ? addWorkingMins(new Date(input.scheduled_at), input.totalDurationMins, schedule).toISOString()
    : null
  let updated: string | null = null
  if (input.actual_start_at && expected) {
    const fromStart = addWorkingMins(new Date(input.actual_start_at), input.totalDurationMins, schedule)
    if (fromStart.toISOString() > expected) updated = fromStart.toISOString()
  }
  return { expected, updated }
}
