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

import {
  lookupActiveJobByPlate,
  buildVehicleInServiceNotice,
} from "@/lib/messenger/booking"

const jobRow = (over: Partial<any> = {}) => ({
  status: "Ongoing",
  plate_number: "ABC 123",
  customer_name: "Jane",
  service: { name: "Ceramic Coating" },
  ...over,
})

beforeEach(() => {
  store.responses = {}
})

describe("buildVehicleInServiceNotice", () => {
  it("names the plate, says it is in service and cannot be re-booked", () => {
    const out = buildVehicleInServiceNotice("ABC 123", { inService: true, status: "Ongoing" })
    expect(out).toContain("plate ABC 123")
    expect(out.toLowerCase()).toContain("currently in service")
    expect(out.toLowerCase()).toContain("can't")
    expect(out).toContain("Ongoing")
  })
})

describe("lookupActiveJobByPlate", () => {
  it("reports a plate with a matching active job as in service", async () => {
    store.responses = { job_order: [{ data: [jobRow()], error: null }] }
    await expect(lookupActiveJobByPlate("ABC 123")).resolves.toEqual({
      inService: true,
      status: "Ongoing",
      serviceName: "Ceramic Coating",
      customerName: "Jane",
    })
  })

  it("matches regardless of plate punctuation / case", async () => {
    store.responses = { job_order: [{ data: [jobRow({ plate_number: "ABC-123" })], error: null }] }
    await expect(lookupActiveJobByPlate("abc 123")).resolves.toMatchObject({ inService: true })
  })

  it("is not in service when no active job matches the plate", async () => {
    store.responses = { job_order: [{ data: [jobRow({ plate_number: "ZZZ 999" })], error: null }] }
    await expect(lookupActiveJobByPlate("ABC 123")).resolves.toEqual({ inService: false })
  })

  it("is not in service for an empty plate", async () => {
    await expect(lookupActiveJobByPlate("")).resolves.toEqual({ inService: false })
  })
})
