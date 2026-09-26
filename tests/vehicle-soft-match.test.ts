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
      customer: [{ data: null, error: null }],
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
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-none")).resolves.toEqual({ kind: "not_linked" })
  })

  it("returns booked_no_active_job (not the verification wall) when the psid's inquiry matches no active job", async () => {
    store.responses = {
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [{ extracted_plate: "XYZ 999", extracted_contact: "09990000000" }], error: null }],
      job_order: [{ data: [job()], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-nomatch")).resolves.toEqual({
      kind: "booked_no_active_job",
      plate: "XYZ 999",
    })
  })

  it("ignores a phone-only match when a different plate matched", async () => {
    // inquiry plate ABC 123 matches job j1; a second job shares the phone but a
    // different plate — plate match wins, phone-only job is not surfaced.
    store.responses = {
      customer: [{ data: null, error: null }],
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

  it("bridges through the customer_record a 'picked a record' job is linked to", async () => {
    // The job's own plate/phone are blank (or differ) but it is linked to the
    // customer_record whose plate matches the psid's booking inquiry.
    store.responses = {
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [{ inquiry_type: "Booking", extracted_plate: "ABC-111", extracted_contact: "09664015109" }], error: null }],
      job_order: [{ data: [job({ plate_number: null, contact_number: null, customer_record_id: "r1", customer: { full_name: "John", plate_number: "ABC-111", contact_number: null } })], error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-bridge")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.soft).toBe(true)
      expect(out.jobs).toHaveLength(1)
    }
  })

  it("returns booked_no_active_job when the psid booked but no job matches", async () => {
    store.responses = {
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [{ inquiry_type: "Booking", extracted_plate: "ABC-111", extracted_contact: "09664015109" }], error: null }],
      job_order: [{ data: [job({ plate_number: "ZZZ 999", contact_number: "09990000000", customer: null })], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-booked")).resolves.toEqual({
      kind: "booked_no_active_job",
      plate: "ABC-111",
    })
  })

  it("still returns not_linked when the psid's inquiries carry no plate or phone", async () => {
    store.responses = {
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [{ inquiry_type: "Human Response", extracted_plate: null, extracted_contact: null }], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-noinfo")).resolves.toEqual({ kind: "not_linked" })
  })
})

describe("resolveOwnVehicleStatus — re-link / unlink isolation", () => {
  it("after a psid is re-linked, only the CURRENT customer's job shows (not the old one via a stale recorded inquiry)", async () => {
    // psid now linked to the "Walk In" record (XYZ 1234). Its history still has a
    // recorded Booking inquiry for ABC 826 (the record it used to be linked to).
    store.responses = {
      customer: [{ data: { id: "cw", full_name: "Walk In", vehicles: [{ id: "walkin", plate_number: "XYZ 1234" }] }, error: null }],
      customer_record: [{ data: [], error: null }],
      inquiry: [{ data: [{ inquiry_type: "Booking", status: "recorded", extracted_plate: "ABC 826", extracted_contact: "09664015109" }], error: null }],
      job_order: [{ data: [
        job({ id: "jNew", plate_number: "XYZ 1234", contact_number: "09121231234", customer_record_id: "walkin", customer: { full_name: "Walk In", plate_number: "XYZ 1234", contact_number: "09121231234" } }),
        job({ id: "jOld", plate_number: "ABC 826", contact_number: "09664015109", customer_record_id: "john", customer: { full_name: "John", plate_number: "ABC 826", contact_number: "09664015109" } }),
      ], error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-relinked")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs.map((j) => j.plate)).toEqual(["XYZ 1234"])
    }
  })

  it("after Sales unlinks the psid, a leftover recorded inquiry does NOT grant status", async () => {
    store.responses = {
      customer: [{ data: null, error: null }],
      inquiry: [{ data: [{ inquiry_type: "Booking", status: "recorded", extracted_plate: "ABC 826", extracted_contact: "09664015109" }], error: null }],
      job_order: [{ data: [job({ plate_number: "ABC 826", contact_number: "09664015109", customer_record_id: "john" })], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-unlinked")).resolves.toEqual({ kind: "not_linked" })
  })

  it("a linked record still ignores an unrelated OPEN inquiry plate", async () => {
    store.responses = {
      customer: [{ data: { id: "c1", full_name: "Jane", vehicles: [{ id: "r1", plate_number: "ABC 123" }] }, error: null }],
      customer_record: [{ data: [], error: null }],
      inquiry: [{ data: [{ inquiry_type: "Booking", status: "open", extracted_plate: "QQQ 000", extracted_contact: "09990000000" }], error: null }],
      job_order: [{ data: [
        job({ id: "mine", plate_number: "ABC 123", customer_record_id: "r1" }),
        job({ id: "other", plate_number: "QQQ 000", contact_number: "09990000000", customer_record_id: "z9" }),
      ], error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-linked")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs.map((j) => j.plate)).toEqual(["ABC 123"])
    }
  })
})
