import { describe, it, expect } from "vitest"
import { stagesNotOwnedBy, teamOfHead, stageOwnerTeam } from "@/lib/head-technician/rework-ownership"

describe("stagesNotOwnedBy", () => {
  it("lets a head flag their own team's stages", () => {
    expect(stagesNotOwnedBy("head_detailer", [{ id: "a", categoryRole: "detailer" }])).toEqual([])
    expect(stagesNotOwnedBy("head_installer", [{ id: "b", categoryRole: "installer" }])).toEqual([])
  })

  it("refuses the other team's stages", () => {
    expect(stagesNotOwnedBy("head_detailer", [{ id: "b", categoryRole: "installer" }])).toEqual(["b"])
    expect(stagesNotOwnedBy("head_installer", [{ id: "a", categoryRole: "detailer" }])).toEqual(["a"])
  })

  it("names only the stages that aren't the caller's in a mixed list", () => {
    expect(
      stagesNotOwnedBy("head_installer", [
        { id: "a", categoryRole: "detailer" },
        { id: "b", categoryRole: "installer" },
        { id: "c", categoryRole: "detailer" },
      ]),
    ).toEqual(["a", "c"])
  })

  it("treats a stage with no category as the detailer team's", () => {
    expect(stagesNotOwnedBy("head_detailer", [{ id: "x", categoryRole: null }])).toEqual([])
    expect(stagesNotOwnedBy("head_installer", [{ id: "x", categoryRole: undefined }])).toEqual(["x"])
  })

  it("allows an empty list", () => {
    expect(stagesNotOwnedBy("head_detailer", [])).toEqual([])
  })
})

describe("team helpers", () => {
  it("maps head roles and category roles to a team", () => {
    expect(teamOfHead("head_installer")).toBe("installer")
    expect(teamOfHead("head_detailer")).toBe("detailer")
    expect(stageOwnerTeam("installer")).toBe("installer")
    expect(stageOwnerTeam("detailer")).toBe("detailer")
    expect(stageOwnerTeam(null)).toBe("detailer")
  })
})
