import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { loadStageDelayedSince } from "@/lib/job-delay-data"

// 2:00 PM Asia/Manila, inside working hours (see tests/job-delay.test.ts).
const FIXED_NOW = "2026-01-06T06:00:00.000Z"
const hourMs = 60 * 60 * 1000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_NOW))
})
afterEach(() => {
  vi.useRealTimers()
})

/** Minimal Supabase stand-in: stage rows for job_stage_progress, no saved schedule. */
function stubClient(stageRows: unknown[], error: { message: string } | null = null) {
  const tables: string[] = []
  const client = {
    from(table: string) {
      tables.push(table)
      if (table === "job_stage_progress") {
        return { select: () => ({ in: async () => ({ data: stageRows, error }) }) }
      }
      return { select: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }) }
    },
  }
  return { client: client as never, tables }
}

const stage = (job: string, status: string, mins: number) => ({
  job_order_id: job,
  status,
  stage_duration_mins: mins,
  service_stage: { stage_duration_mins: mins, sequence_order: 1 },
})
const startedHoursAgo = (h: number) => new Date(Date.now() - h * hourMs).toISOString()

describe("loadStageDelayedSince", () => {
  it("makes no query when no job is both active and started", async () => {
    const { client, tables } = stubClient([])
    const out = await loadStageDelayedSince(client, [
      { id: "a", status: "Pending", actual_start_at: null },
      { id: "b", status: "Released", actual_start_at: startedHoursAgo(5) },
    ])
    expect(out.size).toBe(0)
    expect(tables).toEqual([])
  })

  it("returns a started job whose stage is past its expected end", async () => {
    const { client } = stubClient([stage("late", "pending", 60), stage("ok", "in_progress", 240)])
    const out = await loadStageDelayedSince(client, [
      { id: "late", status: "Ongoing", actual_start_at: startedHoursAgo(3) },
      { id: "ok", status: "Ongoing", actual_start_at: startedHoursAgo(1) },
    ])
    expect([...out.keys()]).toEqual(["late"])
  })

  it("treats a failed stage query as no stage delays", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client } = stubClient([], { message: "boom" })
    const out = await loadStageDelayedSince(client, [
      { id: "late", status: "Ongoing", actual_start_at: startedHoursAgo(3) },
    ])
    expect(out.size).toBe(0)
    spy.mockRestore()
  })
})
