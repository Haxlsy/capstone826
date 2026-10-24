import { describe, it, expect } from "vitest"
import { workloadLabel } from "@/lib/operations/workload"

describe("workloadLabel", () => {
  it("reads as available with no active jobs", () => {
    expect(workloadLabel(0)).toBe("Available")
  })

  it("uses the singular for one job", () => {
    expect(workloadLabel(1)).toBe("On 1 job")
  })

  it("uses the plural for several jobs", () => {
    expect(workloadLabel(3)).toBe("On 3 jobs")
  })
})
