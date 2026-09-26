import { describe, it, expect } from "vitest"
import { planCustomers, type OldRecord } from "@/lib/customers/backfill"

let n = 0
const rec = (o: Partial<OldRecord>): OldRecord => ({
  id: `r${++n}`,
  full_name: "Harley Soldao",
  email: null,
  contact_number: "09158351532",
  psid: null,
  notify_psid: null,
  created_at: `2026-09-${String(n).padStart(2, "0")}T00:00:00Z`,
  ...o,
})

describe("planCustomers", () => {
  it("a psid holder and a same-phone vehicle are ONE customer holding the psid", () => {
    const a = rec({ psid: "P1", email: "h@x.com" })
    const b = rec({ contact_number: "0915-835-1532" })
    const plan = planCustomers([a, b])
    expect(plan.customers).toHaveLength(1)
    expect(plan.customers[0]).toMatchObject({ psid: "P1", email: "h@x.com", contact_number: "09158351532" })
    expect(plan.customerOf.get(b.id)).toBe(`psid:P1`)
  })

  it("a notify_psid row with the SAME phone is the same person", () => {
    const a = rec({ psid: "P1" })
    const b = rec({ notify_psid: "P1" })
    expect(planCustomers([a, b]).customers).toHaveLength(1)
  })

  it("a notify_psid row on a DIFFERENT phone is another person, booked by the psid holder", () => {
    const a = rec({ psid: "P1" })
    const b = rec({ full_name: "Loopy Driver", contact_number: "09998887777", notify_psid: "P1" })
    const plan = planCustomers([a, b])
    expect(plan.customers).toHaveLength(2)
    expect(plan.customerOf.get(b.id)).toBe(`phone:09998887777`)
    expect(plan.bookedBy.get(b.id)).toBe("psid:P1")
    expect(plan.customers.find((c) => c.key === "phone:09998887777")?.psid).toBeNull()
  })

  it("two psid holders sharing a phone stay separate customers, and a psid-less row does not pick one", () => {
    const a = rec({ psid: "P1" })
    const b = rec({ psid: "P2" })
    const c = rec({})
    const plan = planCustomers([a, b, c])
    expect(plan.customers).toHaveLength(3)
    expect(plan.customerOf.get(c.id)).toBe("phone:09158351532")
  })

  it("psid-less rows sharing a plausible phone group together", () => {
    const plan = planCustomers([rec({ full_name: "A" }), rec({ full_name: "A" })])
    expect(plan.customers).toHaveLength(1)
  })

  it("rows without a plausible phone are each their own customer", () => {
    const plan = planCustomers([rec({ contact_number: "12345" }), rec({ contact_number: "12345" })])
    expect(plan.customers).toHaveLength(2)
    expect(plan.customers[0].contact_number).toBe("12345")
  })

  it("takes name/email from the psid holder, else the oldest row; email falls back to any row that has one", () => {
    const old = rec({ full_name: "Old Name", email: null, created_at: "2026-01-01T00:00:00Z" })
    const later = rec({ full_name: "Later Name", email: "l@x.com", created_at: "2026-02-01T00:00:00Z" })
    const c1 = planCustomers([later, old]).customers[0]
    expect(c1.full_name).toBe("Old Name")
    expect(c1.email).toBe("l@x.com")

    const holder = rec({ full_name: "Holder", psid: "P9", created_at: "2026-03-01T00:00:00Z" })
    expect(planCustomers([old, holder]).customers.find((c) => c.psid === "P9")?.full_name).toBe("Holder")
  })
})
