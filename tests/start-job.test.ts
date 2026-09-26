import { describe, it, expect } from "vitest"
import { startRoleFor, canStartJob, headRoleLabel } from "@/lib/head-technician/start-job"

const d = (sequence: number) => ({ role: "detailer", sequence })
const i = (sequence: number) => ({ role: "installer", sequence })

describe("startRoleFor", () => {
  it("detailer-first jobs are started by the Head Detailer", () => {
    expect(startRoleFor([d(1), d(2), i(3), i(4)])).toBe("head_detailer")
  })
  it("installer-only jobs are started by the Head Installer", () => {
    expect(startRoleFor([i(1)])).toBe("head_installer")
  })
  it("an installer-first mixed job is started by the Head Installer", () => {
    expect(startRoleFor([d(3), i(1), i(2)])).toBe("head_installer")
  })
  it("orders by sequence, not array order", () => {
    expect(startRoleFor([i(5), d(1)])).toBe("head_detailer")
  })
  it("defaults to the Head Detailer with no stages or an unknown role", () => {
    expect(startRoleFor([])).toBe("head_detailer")
    expect(startRoleFor([{ role: null, sequence: 1 }])).toBe("head_detailer")
  })
})

describe("canStartJob", () => {
  it("lets only the owning head start", () => {
    expect(canStartJob("head_installer", [i(1)])).toBe(true)
    expect(canStartJob("head_detailer", [i(1)])).toBe(false)
    expect(canStartJob("head_detailer", [d(1), i(2)])).toBe(true)
    expect(canStartJob("head_installer", [d(1), i(2)])).toBe(false)
  })
  it("rejects other roles", () => {
    expect(canStartJob("operations", [d(1)])).toBe(false)
    expect(canStartJob(undefined, [d(1)])).toBe(false)
  })
})

describe("headRoleLabel", () => {
  it("names the role", () => {
    expect(headRoleLabel("head_detailer")).toBe("Head Detailer")
    expect(headRoleLabel("head_installer")).toBe("Head Installer")
  })
})
