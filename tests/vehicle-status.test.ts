import { describe, it, expect } from "vitest"
import { normalizePlate, formatVehicleStatus, type VehicleStatusResult } from "@/lib/messenger/vehicle"

describe("Vehicle-status — normalizePlate", () => {
  it("upper-cases and collapses whitespace", () => {
    expect(normalizePlate("  abc   1234 ")).toBe("ABC 1234")
    expect(normalizePlate("xyz-567")).toBe("XYZ-567")
    expect(normalizePlate(null)).toBe("")
  })
})

describe("Vehicle-status — formatVehicleStatus (pure rendering)", () => {
  it("handles an unknown plate", () => {
    const r: VehicleStatusResult = {
      found: false,
      trusted: false,
      needsVerification: true,
      message: "no customer record",
    }
    expect(formatVehicleStatus(r)).toContain("do not have a vehicle record")
  })

  it("asks for identity verification when untrusted", () => {
    const r: VehicleStatusResult = {
      found: true,
      trusted: false,
      needsVerification: true,
      message: "verification required",
    }
    expect(formatVehicleStatus(r)).toContain("identity must be verified")
  })

  it("reports no active job when the vehicle has none", () => {
    const r: VehicleStatusResult = {
      found: true,
      trusted: true,
      needsVerification: false,
      message: "no active job",
    }
    expect(formatVehicleStatus(r)).toContain("no active job order")
  })

  it("renders status, service, stage and progress for a live job", () => {
    const r: VehicleStatusResult = {
      found: true,
      trusted: true,
      needsVerification: false,
      message: "job found",
      job: {
        plate: "ABC 1234",
        customerName: "John Dulay",
        serviceName: "Ceramic Coating",
        status: "Ongoing",
        currentStage: "Surface Prep",
        completedStages: 1,
        totalStages: 3,
        scheduledAt: null,
        expectedCompletionAt: null,
      },
    }
    const out = formatVehicleStatus(r)
    expect(out).toContain("ABC 1234")
    expect(out).toContain("Ongoing")
    expect(out).toContain("Ceramic Coating")
    expect(out).toContain("Surface Prep")
    expect(out).toContain("1 of 3")
  })
})