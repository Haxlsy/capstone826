import { describe, it, expect } from "vitest"
import {
  requiredTeamRoles,
  teamAssignmentErrors,
  teamAssignmentHint,
} from "@/lib/operations/required-team"

const d = { category_role: "detailer" }
const i = { category_role: "installer" }

describe("requiredTeamRoles", () => {
  it("installer-only stages need only the installer team", () => {
    expect(requiredTeamRoles([i])).toEqual({ detailer: false, installer: true })
  })
  it("detailer-only stages need only the detailer team", () => {
    expect(requiredTeamRoles([d, d, d])).toEqual({ detailer: true, installer: false })
  })
  it("mixed stages need both", () => {
    expect(requiredTeamRoles([d, i, d, i])).toEqual({ detailer: true, installer: true })
  })
  it("keeps both required when there are no stages (not chosen / unavailable)", () => {
    expect(requiredTeamRoles([])).toEqual({ detailer: true, installer: true })
  })
  it("keeps both required when any stage has an unknown role", () => {
    expect(requiredTeamRoles([i, { category_role: null }])).toEqual({ detailer: true, installer: true })
    expect(requiredTeamRoles([i, {}])).toEqual({ detailer: true, installer: true })
    expect(requiredTeamRoles([i, { category_role: "welder" }])).toEqual({ detailer: true, installer: true })
  })
})

describe("teamAssignmentErrors", () => {
  const none = { headDetailerId: null, headInstallerId: null, detailerCount: 0, installerCount: 0 }

  it("installer-only job: no detailer errors even with no detailer picked", () => {
    const errs = teamAssignmentErrors({ detailer: false, installer: true }, none)
    expect(errs.headDetailer).toBeUndefined()
    expect(errs.detailers).toBeUndefined()
    expect(errs.headInstaller).toBeDefined()
    expect(errs.installers).toBeDefined()
  })
  it("installer-only job passes once the installer team is filled", () => {
    const errs = teamAssignmentErrors(
      { detailer: false, installer: true },
      { ...none, headInstallerId: "h1", installerCount: 1 },
    )
    expect(errs).toEqual({})
  })
  it("detailer-only job: no installer errors", () => {
    const errs = teamAssignmentErrors({ detailer: true, installer: false }, none)
    expect(errs.headInstaller).toBeUndefined()
    expect(errs.installers).toBeUndefined()
    expect(errs.headDetailer).toBeDefined()
    expect(errs.detailers).toBeDefined()
  })
  it("both teams needed: four errors when empty, none when filled", () => {
    const both = { detailer: true, installer: true }
    expect(Object.keys(teamAssignmentErrors(both, none))).toHaveLength(4)
    expect(
      teamAssignmentErrors(both, {
        headDetailerId: "a", headInstallerId: "b", detailerCount: 1, installerCount: 2,
      }),
    ).toEqual({})
  })
})

describe("teamAssignmentHint", () => {
  it("says which team is needed", () => {
    expect(teamAssignmentHint({ detailer: true, installer: true })).toContain("All team fields")
    expect(teamAssignmentHint({ detailer: false, installer: true })).toContain("installer")
    expect(teamAssignmentHint({ detailer: true, installer: false })).toContain("detailer")
  })
})
