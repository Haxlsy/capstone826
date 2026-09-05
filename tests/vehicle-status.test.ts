import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Supabase admin mock ───────────────────────────────────────────────────
// `store.responses` maps table name → array of results, consumed in call order
// by whichever terminal (`maybeSingle`, `.update().eq()`, or awaiting the
// builder directly) runs against that table.
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
    b.update = chain
    b.then = (resolve: any, reject: any) =>
      Promise.resolve(nextFor(table)).then(resolve, reject)
    return b
  }
  return { createAdminClient: () => ({ from: (table: string) => makeBuilder(table) }) }
})

vi.mock("@/lib/job-estimates", () => ({
  computeExpectedCompletion: () => ({ expected: null }),
}))

import {
  normalizePlate,
  normalizePhone,
  formatOwnVehicleStatus,
  formatVehicleStatusForCustomer,
  buildLinkVerificationPrompt,
  resolveOwnVehicleStatus,
  assessLinkClaim,
  assessJobOrderLinkClaim,
  type OwnVehicleOutcome,
  type JobStatus,
} from "@/lib/messenger/vehicle"

const job = (over: Partial<any> = {}) => ({
  id: "j1", status: "Ongoing", scheduled_at: null, actual_start_at: null,
  expected_completion_at: null, customer_record_id: "r1", plate_number: "ABC 123",
  contact_number: "09171234567", service: { name: "PPF" }, customer: { full_name: "Jane" },
  ...over,
})
const stages = () => ({
  data: [
    { status: "done", stage_duration_mins: 60, service_stage: { name: "Prep", sequence_order: 1, stage_duration_mins: 60 } },
    { status: "in_progress", stage_duration_mins: 60, service_stage: { name: "Coat", sequence_order: 2, stage_duration_mins: 60 } },
  ],
  error: null,
})

beforeEach(() => {
  store.responses = {}
})

describe("normalizePlate / normalizePhone", () => {
  it("normalizePlate upper-cases and collapses whitespace", () => {
    expect(normalizePlate("  abc   1234 ")).toBe("ABC 1234")
    expect(normalizePlate(null)).toBe("")
  })
  it("normalizePhone canonicalises PH formats", () => {
    expect(normalizePhone("+63 917 123 4567")).toBe("09171234567")
    expect(normalizePhone("0917-123-4567")).toBe("09171234567")
    expect(normalizePhone("9171234567")).toBe("09171234567")
    expect(normalizePhone("")).toBe("")
  })
})

describe("formatOwnVehicleStatus (pure rendering)", () => {
  it("refuses on a plate mismatch without leaking data", () => {
    const out = formatOwnVehicleStatus({ kind: "ok", jobs: [] }, { plateMismatch: true })
    expect(out).toContain("NOT a vehicle registered")
    expect(out).not.toContain("Status for plate")
  })

  it("forbids the model from sharing status or faking a lookup when unlinked", () => {
    const out = formatOwnVehicleStatus({ kind: "not_linked" })
    expect(out).toMatch(/not linked to any customer record/i)
    expect(out).toMatch(/Do NOT share any status/i)
    expect(out).toMatch(/Do NOT claim to have checked/i)
    expect(out).toMatch(/no such lookup was performed/i)
  })

  it("reports no active job for a linked customer with zero jobs", () => {
    expect(formatOwnVehicleStatus({ kind: "ok", jobs: [] })).toContain("no active job order")
  })

  it("renders one job", () => {
    const outcome: OwnVehicleOutcome = {
      kind: "ok",
      jobs: [{
        plate: "ABC 1234", customerName: "John", serviceName: "Ceramic Coating",
        status: "Ongoing", currentStage: "Surface Prep", completedStages: 1,
        totalStages: 3, scheduledAt: null, expectedCompletionAt: null,
      }],
    }
    const out = formatOwnVehicleStatus(outcome)
    expect(out).toContain("ABC 1234")
    expect(out).toContain("1 of 3")
    expect(out).not.toContain("vehicles currently in service")
  })

  it("lists multiple jobs, and narrows to one with focusPlate", () => {
    const mk = (plate: string): any => ({
      plate, customerName: "John", serviceName: "PPF", status: "Ongoing",
      currentStage: "Prep", completedStages: 0, totalStages: 2,
      scheduledAt: null, expectedCompletionAt: null,
    })
    const outcome: OwnVehicleOutcome = { kind: "ok", jobs: [mk("ABC 123"), mk("XYZ 789")] }
    const all = formatOwnVehicleStatus(outcome)
    expect(all).toContain("2 vehicles currently in service")
    expect(all).toContain("ABC 123")
    expect(all).toContain("XYZ 789")

    const one = formatOwnVehicleStatus(outcome, { focusPlate: "XYZ 789" })
    expect(one).toContain("XYZ 789")
    expect(one).not.toContain("ABC 123")
    expect(one).not.toContain("2 vehicles")
  })
})

describe("formatVehicleStatusForCustomer (deterministic reply, no Gemini)", () => {
  const j = (over: Partial<JobStatus> = {}): JobStatus => ({
    plate: "ABC-826", customerName: "John", serviceName: "Graphene Coating",
    status: "Pending", currentStage: "Stage 1", completedStages: 0, totalStages: 6,
    scheduledAt: null, expectedCompletionAt: null, ...over,
  })

  it("returns the deterministic link ask for not_linked — never null", () => {
    // Returning null used to hand the turn to Gemini, which then invented a
    // lookup ("no active job order for plate XYZ-1234") that never ran.
    const out = formatVehicleStatusForCustomer({ kind: "not_linked" })!
    expect(out).toBe(buildLinkVerificationPrompt())
    expect(out).toMatch(/isn't linked|not linked/i)
    expect(out).toMatch(/job order code/i)
  })

  it("never claims a lookup happened on not_linked", () => {
    const out = formatVehicleStatusForCustomer({ kind: "not_linked" })!
    expect(out).not.toMatch(/checked|searched|looked up|no active job order/i)
  })

  it("uses the admin's configured wording for not_linked", () => {
    const notLinkedMessage = "Custom admin wording — send your plate and phone."
    expect(formatVehicleStatusForCustomer({ kind: "not_linked" }, { notLinkedMessage }))
      .toBe(notLinkedMessage)
  })

  it("falls back to the default when the configured wording is blank", () => {
    for (const notLinkedMessage of ["", "  ", null, undefined]) {
      expect(formatVehicleStatusForCustomer({ kind: "not_linked" }, { notLinkedMessage }))
        .toBe(buildLinkVerificationPrompt())
    }
  })

  it("ignores the configured wording for a linked customer's status", () => {
    const notLinkedMessage = "SHOULD-NOT-APPEAR"
    const withJob = formatVehicleStatusForCustomer({ kind: "ok", jobs: [j()] }, { notLinkedMessage })!
    const noJob = formatVehicleStatusForCustomer({ kind: "ok", jobs: [] }, { notLinkedMessage })!
    const booked = formatVehicleStatusForCustomer({ kind: "booked_no_active_job", plate: "ABC-826" }, { notLinkedMessage })!
    for (const out of [withJob, noJob, booked]) expect(out).not.toContain(notLinkedMessage)
    expect(withJob).toContain("ABC-826")
  })

  it("renders a single job with plate, status, service and progress", () => {
    const out = formatVehicleStatusForCustomer({ kind: "ok", jobs: [j()] })!
    expect(out).toContain("ABC-826")
    expect(out).toContain("Status: Pending")
    expect(out).toContain("Graphene Coating")
    expect(out).toContain("0 of 6 stages")
    expect(out).not.toMatch(/provide the following details/i)
  })

  it("friendly line for a booking with no active job", () => {
    const out = formatVehicleStatusForCustomer({ kind: "booked_no_active_job", plate: "ABC-826" })!
    expect(out).toContain("ABC-826")
    expect(out).toMatch(/hasn't been scheduled/i)
    expect(out).not.toMatch(/provide the following details/i)
  })

  it("linked customer with nothing in service is told so (no verification ask)", () => {
    const out = formatVehicleStatusForCustomer({ kind: "ok", jobs: [] })!
    expect(out).toMatch(/don't have a vehicle in service/i)
  })

  it("lists multiple jobs", () => {
    const out = formatVehicleStatusForCustomer({ kind: "ok", jobs: [j(), j({ plate: "XYZ-789" })] })!
    expect(out).toContain("ABC-826")
    expect(out).toContain("XYZ-789")
  })
})

describe("resolveOwnVehicleStatus — PSID scoping + aggregation", () => {
  it("returns not_linked when no customer_record matches the psid", async () => {
    store.responses = { customer_record: [{ data: null, error: null }] }
    await expect(resolveOwnVehicleStatus("psid-x")).resolves.toEqual({ kind: "not_linked" })
  })

  it("returns ok with no jobs when the person has nothing in service", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09171234567", plate_number: "ABC 123" }, error: null }],
      job_order: [{ data: [], error: null }],
    }
    await expect(resolveOwnVehicleStatus("psid-1")).resolves.toEqual({ kind: "ok", jobs: [] })
  })

  it("returns the job on the psid record", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09171234567", plate_number: "ABC 123" }, error: null }],
      job_order: [{ data: [job()], error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-1")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs).toHaveLength(1)
      expect(out.jobs[0].plate).toBe("ABC 123")
      expect(out.jobs[0].currentStage).toBe("Coat")
      expect(out.jobs[0].completedStages).toBe(1)
    }
  })

  it("aggregates a 2nd car by verified phone (different record, psid=null)", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "0917 123 4567", plate_number: "ABC 123" }, error: null }],
      job_order: [{ data: [
        job({ id: "j1", customer_record_id: "r1", plate_number: "ABC 123" }),
        job({ id: "j2", customer_record_id: "r2", plate_number: "XYZ 789", contact_number: "+639171234567" }),
      ], error: null }],
      job_stage_progress: [stages(), stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-1")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs.map((j) => j.plate).sort()).toEqual(["ABC 123", "XYZ 789"])
    }
  })

  it("does NOT pull a job for an unrelated record / phone", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09171234567", plate_number: "ABC 123" }, error: null }],
      job_order: [{ data: [
        job({ id: "j2", customer_record_id: "rZ", plate_number: "ZZZ 000", contact_number: "09990001111" }),
      ], error: null }],
    }
    const out = await resolveOwnVehicleStatus("psid-1")
    expect(out).toEqual({ kind: "ok", jobs: [] })
  })

  it("falls back to psid-record jobs only when a junk phone matches too many", async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      job({ id: `j${i}`, customer_record_id: `other-${i}`, plate_number: `P${i}`, contact_number: "09000000000" }))
    many.push(job({ id: "mine", customer_record_id: "r1", plate_number: "MINE 1", contact_number: "09000000000" }))
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09000000000", plate_number: "MINE 1" }, error: null }],
      job_order: [{ data: many, error: null }],
      job_stage_progress: [stages()],
    }
    const out = await resolveOwnVehicleStatus("psid-1")
    expect(out.kind).toBe("ok")
    if (out.kind === "ok") {
      expect(out.jobs.map((j) => j.plate)).toEqual(["MINE 1"])
    }
  })
})

describe("assessLinkClaim (read-only — never links)", () => {
  it("match_unlinked when plate + phone match a record with no psid", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane Cruz", contact_number: "0917 123 4567", psid: null }, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "ABC 123", phone: "+639171234567" })
    expect(res).toEqual({ kind: "match_unlinked", recordName: "Jane Cruz" })
  })

  it("resolves the record via a job_order when the plate is on no record", async () => {
    store.responses = {
      customer_record: [
        { data: null, error: null }, // by plate → none
        { data: { id: "r9", full_name: "Jane", contact_number: "09171234567", psid: null }, error: null }, // via job
      ],
      job_order: [{ data: { customer_record_id: "r9" }, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "XYZ 789", phone: "09171234567" })
    expect(res.kind).toBe("match_unlinked")
  })

  it("phone_mismatch when the record exists but the phone is wrong", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09179999999", psid: null }, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "ABC 123", phone: "09171234567" })
    expect(res.kind).toBe("phone_mismatch")
  })

  it("owned_by_other when the plate's record already has a different psid", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09171234567", psid: "someone-else" }, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "ABC 123", phone: "09171234567" })
    expect(res).toEqual({ kind: "owned_by_other", phoneMatched: true })
  })

  it("owned_by_other with phoneMatched=false when phone is also wrong", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", full_name: "Jane", contact_number: "09179999999", psid: "someone-else" }, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "ABC 123", phone: "09171234567" })
    expect(res).toEqual({ kind: "owned_by_other", phoneMatched: false })
  })

  it("no_record when nothing has that plate", async () => {
    store.responses = {
      customer_record: [{ data: null, error: null }],
      job_order: [{ data: null, error: null }],
    }
    const res = await assessLinkClaim({ psid: "psid-1", plate: "ZZZ 000", phone: "09171234567" })
    expect(res.kind).toBe("no_record")
  })
})

describe("assessJobOrderLinkClaim (auto-links on an unlinked match)", () => {
  it("no_record when the code doesn't resolve to a linkable job order", async () => {
    store.responses = {
      job_order: [{ data: null, error: null }],
    }
    const res = await assessJobOrderLinkClaim({ psid: "psid-1", code: "JO-000000" })
    expect(res.kind).toBe("no_record")
  })

  it("no_record when the job order has no linked customer_record", async () => {
    store.responses = {
      job_order: [{ data: { customer_record_id: null }, error: null }],
    }
    const res = await assessJobOrderLinkClaim({ psid: "psid-1", code: "JO-8X2K9F" })
    expect(res.kind).toBe("no_record")
  })

  it("owned_by_other when the code's record already has a different psid", async () => {
    store.responses = {
      job_order: [{ data: { customer_record_id: "r1" }, error: null }],
      customer_record: [{ data: { id: "r1", psid: "someone-else" }, error: null }],
    }
    const res = await assessJobOrderLinkClaim({ psid: "psid-1", code: "JO-8X2K9F" })
    expect(res).toEqual({ kind: "owned_by_other" })
  })

  it("links the psid and returns status when the record is unlinked", async () => {
    store.responses = {
      job_order: [
        { data: { customer_record_id: "r1" }, error: null }, // code lookup
        { data: [], error: null },                            // resolveOwnVehicleStatus active jobs
      ],
      customer_record: [
        { data: { id: "r1", psid: null }, error: null },                                        // record read
        { data: { id: "r1" }, error: null },                                                     // conditional update — success
        { data: { id: "r1", full_name: "Jane", contact_number: "09171234567", plate_number: "ABC 123", psid: "psid-1" }, error: null }, // resolveOwnVehicleStatus's own lookup
      ],
      inquiry: [{ data: [], error: null }],
    }
    const res = await assessJobOrderLinkClaim({ psid: "psid-1", code: "jo-8x2k9f" })
    expect(res.kind).toBe("linked")
    if (res.kind === "linked") expect(res.outcome).toEqual({ kind: "ok", jobs: [] })
  })

  it("treats a lost race on the conditional update as owned_by_other", async () => {
    store.responses = {
      job_order: [{ data: { customer_record_id: "r1" }, error: null }],
      customer_record: [
        { data: { id: "r1", psid: null }, error: null },       // record read — looked unlinked
        { data: null, error: null },                            // conditional update — 0 rows, lost the race
        { data: { psid: "someone-else" }, error: null },        // recheck — someone else grabbed it
      ],
    }
    const res = await assessJobOrderLinkClaim({ psid: "psid-1", code: "JO-8X2K9F" })
    expect(res).toEqual({ kind: "owned_by_other" })
  })
})
