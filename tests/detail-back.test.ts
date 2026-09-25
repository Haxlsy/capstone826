import { describe, it, expect } from "vitest"
import { resolveDetailBack } from "@/lib/operations/detail-back"

// Defect (TC-034): opening a record from Job Records and pressing Back landed
// on Job Management, because the shared detail page hard-coded that link.
describe("resolveDetailBack", () => {
  it("returns to Job Records when opened from there", () => {
    expect(resolveDetailBack("records")).toEqual({
      href: "/dashboard/job-order-records",
      label: "Back to Job Records",
    })
  })

  it("defaults to Job Management when there is no origin", () => {
    expect(resolveDetailBack(undefined)).toEqual({
      href: "/dashboard/job-management",
      label: "Back to Job Management",
    })
  })

  it("ignores unknown, repeated, and hostile values instead of trusting them", () => {
    for (const bad of ["", "nope", "javascript:alert(1)", "//evil.example", "__proto__", "constructor"]) {
      expect(resolveDetailBack(bad).href).toBe("/dashboard/job-management")
    }
    expect(resolveDetailBack(["records", "records"]).href).toBe("/dashboard/job-management")
  })
})
