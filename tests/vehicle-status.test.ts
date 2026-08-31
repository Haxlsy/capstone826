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
    b.update = () => {
      const res = nextFor(table)
      return { eq: () => Promise.resolve(res) }
    }
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
  resolveOwnVehicleStatus,
  verifyAndLinkPsid,
  type OwnVehicleOutcome,
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

  it("tells an unlinked customer no vehicle is registered", () => {
    expect(formatOwnVehicleStatus({ kind: "not_linked" })).toContain("No vehicle is registered")
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

describe("verifyAndLinkPsid", () => {
  it("links when plate + phone match and psid is unset", async () => {
    store.responses = {
      customer_record: [
        { data: { id: "r1", contact_number: "0917 123 4567", psid: null }, error: null }, // by plate
        { data: null, error: null },                                                       // update
        { data: { id: "r1", full_name: "Jane", contact_number: "09171234567", plate_number: "ABC 123" }, error: null }, // resolveOwn
      ],
      job_order: [{ data: [], error: null }],
    }
    const res = await verifyAndLinkPsid({ psid: "psid-1", plate: "ABC 123", phone: "+639171234567" })
    expect(res.kind).toBe("linked")
  })

  it("resolves the record via a job_order when the plate is on no record", async () => {
    store.responses = {
      customer_record: [
        { data: null, error: null },                                                        // by plate → none
        { data: { id: "r9", contact_number: "09171234567", psid: null }, error: null },      // by job.customer_record_id
        { data: null, error: null },                                                         // update
        { data: { id: "r9", full_name: "Jane", contact_number: "09171234567", plate_number: "OLD 1" }, error: null }, // resolveOwn
      ],
      job_order: [
        { data: { customer_record_id: "r9" }, error: null }, // by plate
        { data: [], error: null },                           // resolveOwn active jobs
      ],
    }
    const res = await verifyAndLinkPsid({ psid: "psid-1", plate: "XYZ 789", phone: "09171234567" })
    expect(res.kind).toBe("linked")
  })

  it("returns no_match on a phone mismatch", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", contact_number: "09179999999", psid: null }, error: null }],
      job_order: [],
    }
    const res = await verifyAndLinkPsid({ psid: "psid-1", plate: "ABC 123", phone: "09171234567" })
    expect(res.kind).toBe("no_match")
  })

  it("returns conflict when the plate's record has another psid", async () => {
    store.responses = {
      customer_record: [{ data: { id: "r1", contact_number: "09171234567", psid: "someone-else" }, error: null }],
      job_order: [],
    }
    const res = await verifyAndLinkPsid({ psid: "psid-1", plate: "ABC 123", phone: "09171234567" })
    expect(res.kind).toBe("conflict")
  })

  it("returns no_match when nothing has that plate", async () => {
    store.responses = {
      customer_record: [{ data: null, error: null }],
      job_order: [{ data: null, error: null }],
    }
    const res = await verifyAndLinkPsid({ psid: "psid-1", plate: "ZZZ 000", phone: "09171234567" })
    expect(res.kind).toBe("no_match")
  })
})
