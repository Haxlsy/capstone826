/* eslint-disable @typescript-eslint/no-explicit-any -- untyped Supabase query-builder mock, matches tests/vehicle-status.test.ts */
import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Supabase admin mock (same pattern as vehicle-status.test.ts) ──────────
const store = vi.hoisted(() => ({ responses: {} as Record<string, any[]> }))

vi.mock("@/lib/supabase/admin", () => {
  const nextFor = (table: string) => {
    const q = store.responses[table]
    return q && q.length ? q.shift() : { data: null, error: null }
  }
  const makeBuilder = (table: string) => {
    const b: any = {}
    const chain = () => b
    for (const m of ["select", "eq", "in", "ilike", "order", "limit", "or", "is", "not"]) b[m] = chain
    b.maybeSingle = async () => nextFor(table)
    b.single = async () => nextFor(table)
    b.update = () => ({ eq: () => Promise.resolve(nextFor(table)) })
    b.then = (resolve: any, reject: any) => Promise.resolve(nextFor(table)).then(resolve, reject)
    return b
  }
  return { createAdminClient: () => ({ from: (table: string) => makeBuilder(table) }) }
})

vi.mock("@/lib/job-estimates", () => ({
  computeExpectedCompletion: () => ({ expected: null }),
}))

import { resolveOwnVehicleStatus } from "@/lib/messenger/vehicle"

const job = (over: Partial<any> = {}) => ({
  id: "j1", status: "Ongoing", scheduled_at: null, actual_start_at: null,
  expected_completion_at: null, customer_record_id: null, plate_number: "ABC 123",
  contact_number: "09171234567", service: { name: "PPF" }, customer: null,
  ...over,
})
const stages = () => ({
  data: [{ status: "in_progress", stage_duration_mins: 60, service_stage: { name: "Prep", sequence_order: 1, stage_duration_mins: 60 } }],
  error: null,
})

beforeEach(() => {
  store.responses = {}
})

describe("resolveOwnVehicleStatus — inquiry soft-match (Testing Note #3)", () => {
  it("matches an active job by the plate the psid gave in its own inquiry", async () => {
    store.responses = {
      customer_record: [{ data: null, error: null }],
      inquiry: [{ data: [{ extracted_plate: "ABC 123", extracted_contact: "09171234567" }], error: null }],
      job_order: [{ data: [job()], error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-soft")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.soft).toBe(true)
      expect(out.jobs).toHaveLength(1)
      expect(out.jobs[0].plate).toBe("ABC 123")
    }
  })

  it("still returns not_linked when the psid has no inquiry and no record", async () => {
    store.responses = {
      customer_record: [{ data: null, error: null }],
      inquiry: [{ data: [], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-none")).resolves.toEqual({ kind: "not_linked" })
  })

  it("returns not_linked when the inquiry plate/phone match no active job", async () => {
    store.responses = {
      customer_record: [{ data: null, error: null }],
      inquiry: [{ data: [{ extracted_plate: "XYZ 999", extracted_contact: "09990000000" }], error: null }],
      job_order: [{ data: [job()], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-nomatch")).resolves.toEqual({ kind: "not_linked" })
  })

  it("ignores a phone-only match when a different plate matched", async () => {
    // inquiry plate ABC 123 matches job j1; a second job shares the phone but a
    // different plate — plate match wins, phone-only job is not surfaced.
    store.responses = {
      customer_record: [{ data: null, error: null }],
      inquiry: [{ data: [{ extracted_plate: "ABC 123", extracted_contact: "09171234567" }], error: null }],
      job_order: [{ data: [job(), job({ id: "j2", plate_number: "DEF 456" })], error: null }],
      job_stage_progress: [stages(), stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-soft")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs.map((j) => j.plate)).toEqual(["ABC 123"])
    }
  })
})
