import { describe, it, expect } from "vitest"
import { stageGroupHead, type JobHeads } from "@/lib/operations/stage-group-head"

const heads: JobHeads = {
  head_detailer: { full_name: "Caleb Dela Cruz" },
  head_installer: null,
  head_detailer_substitutes: [{ full_name: "Ashley Cortez" }],
  head_installer_substitutes: [],
}

describe("stageGroupHead", () => {
  it("names the Head Detailer and their substitutes for a detailer group", () => {
    expect(stageGroupHead("detailer", heads)).toEqual({
      label: "Head Detailer",
      name: "Caleb Dela Cruz",
      assigned: true,
      substitutes: ["Ashley Cortez"],
    })
  })

  it("names the Head Installer for an installer group", () => {
    const out = stageGroupHead("installer", { ...heads, head_installer: { full_name: "Ivan Reyes" } })
    expect(out).toEqual({ label: "Head Installer", name: "Ivan Reyes", assigned: true, substitutes: [] })
  })

  it("says Unassigned when nobody holds the role", () => {
    expect(stageGroupHead("installer", heads)).toEqual({
      label: "Head Installer",
      name: "Unassigned",
      assigned: false,
      substitutes: [],
    })
  })

  it("returns nothing for a group with no role", () => {
    expect(stageGroupHead(null, heads)).toBeNull()
    expect(stageGroupHead(undefined, heads)).toBeNull()
  })
})
