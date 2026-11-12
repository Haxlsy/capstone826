import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { findDelayAlerts, type DelayJob, type DelayStage, type DelayTeamMember } from "@/lib/job-delay-alerts"

// 2:00 PM Manila, mid working day, so addWorkingMins offsets stay inside
// working hours (same reason as tests/job-delay.test.ts).
const FIXED_NOW = "2026-01-06T06:00:00.000Z"
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})
afterEach(() => vi.useRealTimers())

const minMs = 60 * 1000
const hourMs = 60 * minMs
const past = (ms: number) => new Date(Date.now() - ms).toISOString()
const future = (ms: number) => new Date(Date.now() + ms).toISOString()

function job(over: Partial<DelayJob> = {}): DelayJob {
  return {
    id: "job1",
    status: "Ongoing",
    job_order_code: "JO-0012",
    actual_start_at: past(2 * hourMs),
    expected_completion_at: future(5 * hourMs),
    ...over,
  }
}

function stage(over: Partial<DelayStage> = {}): DelayStage {
  return {
    id: "s1",
    job_order_id: "job1",
    status: "in_progress",
    name: "Ceramic Coating",
    sequence_order: 1,
    stage_duration_mins: 60,
    template_duration_mins: 60,
    category_role: "detailer",
    current_rework_round: 0,
    ...over,
  }
}

const team: DelayTeamMember[] = [
  { job_order_id: "job1", user_account_id: "det", role_in_job: "head_detailer" },
  { job_order_id: "job1", user_account_id: "ins", role_in_job: "head_installer" },
  { job_order_id: "job1", user_account_id: null, role_in_job: "detailer" },
]

describe("findDelayAlerts: job deadline", () => {
  it("alerts both heads once the job is past its deadline", () => {
    const deadline = past(30 * minMs)
    const alerts = findDelayAlerts([job({ expected_completion_at: deadline })], [], team)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].kind).toBe("job")
    expect(alerts[0].alert_key).toBe(`job:${deadline}`)
    expect(alerts[0].head_ids.sort()).toEqual(["det", "ins"])
    expect(alerts[0].message).toMatch(/^Job JO-0012 is past its deadline \(due .+\)\.$/)
  })

  it("does not alert before the deadline, or for a finished job", () => {
    expect(findDelayAlerts([job()], [], team)).toHaveLength(0)
    expect(findDelayAlerts([job({ status: "Released", expected_completion_at: past(hourMs) })], [], team)).toHaveLength(0)
  })

  it("skips a deadline missed more than 24 hours ago", () => {
    expect(findDelayAlerts([job({ expected_completion_at: past(25 * hourMs) })], [], team)).toHaveLength(0)
  })

  it("gives an extended deadline a new key", () => {
    const a = findDelayAlerts([job({ expected_completion_at: past(hourMs) })], [], team)[0]
    const b = findDelayAlerts([job({ expected_completion_at: past(10 * minMs) })], [], team)[0]
    expect(a.alert_key).not.toBe(b.alert_key)
  })
})

describe("findDelayAlerts: late stages", () => {
  it("alerts only the head who owns the stage's category", () => {
    const detailer = findDelayAlerts([job()], [stage()], team)
    expect(detailer).toHaveLength(1)
    expect(detailer[0].kind).toBe("stage")
    expect(detailer[0].head_ids).toEqual(["det"])
    expect(detailer[0].message).toMatch(/^Stage "Ceramic Coating" on job JO-0012 is running late/)

    const installer = findDelayAlerts([job()], [stage({ category_role: "installer" })], team)
    expect(installer[0].head_ids).toEqual(["ins"])
  })

  it("falls back to every head when no head of that role is on the job", () => {
    const onlyDetailer = team.filter((t) => t.role_in_job !== "head_installer")
    const alerts = findDelayAlerts([job()], [stage({ category_role: "installer" })], onlyDetailer)
    expect(alerts[0].head_ids).toEqual(["det"])
  })

  it("includes substitute heads", () => {
    const withSub = [...team, { job_order_id: "job1", user_account_id: "sub", role_in_job: "head_detailer" }]
    const alerts = findDelayAlerts([job()], [stage()], withSub)
    expect(alerts[0].head_ids.sort()).toEqual(["det", "sub"])
  })

  it("skips stages that are done or sent for rework", () => {
    expect(findDelayAlerts([job()], [stage({ status: "done" })], team)).toHaveLength(0)
    expect(findDelayAlerts([job()], [stage({ status: "for_rework" })], team)).toHaveLength(0)
  })

  it("skips stages that are still on time, or a job that has not started", () => {
    expect(findDelayAlerts([job()], [stage({ stage_duration_mins: 180 })], team)).toHaveLength(0)
    expect(findDelayAlerts([job({ actual_start_at: null, status: "Pending" })], [stage()], team)).toHaveLength(0)
  })

  it("gives a new rework round a new key", () => {
    const a = findDelayAlerts([job()], [stage()], team)[0]
    const b = findDelayAlerts([job()], [stage({ current_rework_round: 1 })], team)[0]
    expect(a.alert_key).not.toBe(b.alert_key)
  })

  it("reports a late stage and a missed deadline separately", () => {
    const alerts = findDelayAlerts([job({ expected_completion_at: past(10 * minMs) })], [stage()], team)
    expect(alerts.map((a) => a.kind).sort()).toEqual(["job", "stage"])
  })
})
