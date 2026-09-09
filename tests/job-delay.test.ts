import { describe, it, expect } from "vitest"
import { isJobDelayed, computeStageDelays, hasAnyStageDelayed, displayJobStatus, ACTIVE_JOB_STATUSES } from "@/lib/job-delay"

const hourMs = 60 * 60 * 1000
const past   = (ms: number) => new Date(Date.now() - ms).toISOString()
const future = (ms: number) => new Date(Date.now() + ms).toISOString()

describe("isJobDelayed", () => {
  it("is always delayed once staff literally marked the job Delayed", () => {
    expect(isJobDelayed({ status: "Delayed", expected_completion_at: future(hourMs) })).toBe(true)
    expect(isJobDelayed({ status: "Delayed", expected_completion_at: null })).toBe(true)
  })

  it("is not delayed while still on time", () => {
    for (const status of ACTIVE_JOB_STATUSES) {
      expect(isJobDelayed({ status, expected_completion_at: future(hourMs) })).toBe(false)
    }
  })

  it("is delayed once an active job runs past its expected completion", () => {
    for (const status of ACTIVE_JOB_STATUSES) {
      expect(isJobDelayed({ status, expected_completion_at: past(hourMs) })).toBe(true)
    }
  })

  it("is never delayed for a non-active status, even if the date has passed", () => {
    for (const status of ["Released", "Cancelled"]) {
      expect(isJobDelayed({ status, expected_completion_at: past(hourMs) })).toBe(false)
    }
  })

  it("is not delayed when there is no expected_completion_at to compare against", () => {
    expect(isJobDelayed({ status: "Ongoing", expected_completion_at: null })).toBe(false)
  })
})

describe("computeStageDelays", () => {
  it("flags no stages when the job hasn't started yet", () => {
    const result = computeStageDelays(
      [{ id: "s1", status: "in_progress", sequence_order: 1, stage_duration_mins: 60, service_stage_duration_mins: null }],
      null,
    )
    expect(result.get("s1")).toEqual({ expected_end_at: null, is_delayed: false })
  })

  it("flags an incomplete stage whose cumulative expected end has passed", () => {
    // Job started 3 hours ago; a single 60-minute stage should have finished
    // long ago and is still not done.
    const startedAt = new Date(Date.now() - 3 * hourMs).toISOString()
    const result = computeStageDelays(
      [{ id: "s1", status: "in_progress", sequence_order: 1, stage_duration_mins: 60, service_stage_duration_mins: null }],
      startedAt,
    )
    expect(result.get("s1")?.is_delayed).toBe(true)
    expect(result.get("s1")?.expected_end_at).not.toBeNull()
  })

  it("does not flag a stage still comfortably within its expected duration", () => {
    const startedAt = new Date().toISOString()
    const result = computeStageDelays(
      [{ id: "s1", status: "in_progress", sequence_order: 1, stage_duration_mins: 480, service_stage_duration_mins: null }],
      startedAt,
    )
    expect(result.get("s1")?.is_delayed).toBe(false)
  })

  it("never flags a done or for_rework stage, regardless of how late it is", () => {
    const startedAt = new Date(Date.now() - 3 * hourMs).toISOString()
    const result = computeStageDelays(
      [
        { id: "done",       status: "done",       sequence_order: 1, stage_duration_mins: 60, service_stage_duration_mins: null },
        { id: "for_rework", status: "for_rework",  sequence_order: 2, stage_duration_mins: 60, service_stage_duration_mins: null },
      ],
      startedAt,
    )
    expect(result.get("done")?.is_delayed).toBe(false)
    expect(result.get("for_rework")?.is_delayed).toBe(false)
  })

  it("falls back to the service stage's default duration when no override is set", () => {
    const startedAt = new Date(Date.now() - 3 * hourMs).toISOString()
    const result = computeStageDelays(
      [{ id: "s1", status: "in_progress", sequence_order: 1, stage_duration_mins: null, service_stage_duration_mins: 60 }],
      startedAt,
    )
    expect(result.get("s1")?.is_delayed).toBe(true)
  })

  it("accumulates duration across stages in sequence order, not array order", () => {
    // Stage 2 (sequence 1) finishes almost immediately; stage 1 (sequence 2)
    // needs 8 hours on top of that — passed out of order deliberately.
    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString()
    const result = computeStageDelays(
      [
        { id: "second", status: "in_progress", sequence_order: 2, stage_duration_mins: 480, service_stage_duration_mins: null },
        { id: "first",  status: "in_progress", sequence_order: 1, stage_duration_mins: 10,  service_stage_duration_mins: null },
      ],
      startedAt,
    )
    // 30 minutes in: stage "first" (10 min) should already be overdue,
    // stage "second" (cumulative 490 min) should not be yet.
    expect(result.get("first")?.is_delayed).toBe(true)
    expect(result.get("second")?.is_delayed).toBe(false)
  })
})

describe("hasAnyStageDelayed", () => {
  it("is true when at least one stage in the map is delayed", () => {
    const map = new Map([
      ["s1", { expected_end_at: null, is_delayed: false }],
      ["s2", { expected_end_at: null, is_delayed: true }],
    ])
    expect(hasAnyStageDelayed(map)).toBe(true)
  })

  it("is false when no stage is delayed", () => {
    const map = new Map([
      ["s1", { expected_end_at: null, is_delayed: false }],
      ["s2", { expected_end_at: null, is_delayed: false }],
    ])
    expect(hasAnyStageDelayed(map)).toBe(false)
  })

  it("also accepts a plain array of results", () => {
    expect(hasAnyStageDelayed([{ expected_end_at: null, is_delayed: true }])).toBe(true)
    expect(hasAnyStageDelayed([{ expected_end_at: null, is_delayed: false }])).toBe(false)
  })
})

describe("displayJobStatus", () => {
  // "Delayed" is no longer something staff sets manually — every badge/dot
  // across Admin, Operations, Sales, and the Job Calendar resolves through
  // this instead of trusting the raw stored status for that one label.
  it("shows Delayed once the job is computed-overdue, regardless of its real status", () => {
    for (const status of ACTIVE_JOB_STATUSES) {
      expect(displayJobStatus(status, true)).toBe("Delayed")
    }
  })

  it("shows the real status when not overdue", () => {
    for (const status of ACTIVE_JOB_STATUSES) {
      expect(displayJobStatus(status, false)).toBe(status)
    }
  })

  it("doesn't double-label a legacy row whose real status is already Delayed", () => {
    expect(displayJobStatus("Delayed", true)).toBe("Delayed")
    expect(displayJobStatus("Delayed", false)).toBe("Delayed")
  })

  it("never overrides a finished status, even if somehow flagged overdue", () => {
    expect(displayJobStatus("Released", true)).toBe("Released")
    expect(displayJobStatus("Cancelled", true)).toBe("Cancelled")
  })
})
