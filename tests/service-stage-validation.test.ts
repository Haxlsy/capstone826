import { describe, it, expect } from "vitest"
import { findDuplicateStageIds, findDuplicateStageName } from "@/lib/admin/service-stage-validation"

describe("findDuplicateStageIds", () => {
  it("is empty when every stage name is unique", () => {
    const stages = [{ id: "a", name: "Wash" }, { id: "b", name: "Wax" }]
    expect(findDuplicateStageIds(stages)).toEqual(new Set())
  })

  it("flags an exact duplicate", () => {
    const stages = [{ id: "a", name: "Wash" }, { id: "b", name: "Wash" }]
    expect(findDuplicateStageIds(stages)).toEqual(new Set(["b"]))
  })

  it("flags a case- and whitespace-variant duplicate", () => {
    const stages = [{ id: "a", name: "Interior Wash" }, { id: "b", name: "  interior wash  " }]
    expect(findDuplicateStageIds(stages)).toEqual(new Set(["b"]))
  })

  it("flags every later occurrence, not just the second", () => {
    const stages = [{ id: "a", name: "Wash" }, { id: "b", name: "Wash" }, { id: "c", name: "Wash" }]
    expect(findDuplicateStageIds(stages)).toEqual(new Set(["b", "c"]))
  })

  it("never treats two empty names as duplicates of each other", () => {
    const stages = [{ id: "a", name: "" }, { id: "b", name: "   " }]
    expect(findDuplicateStageIds(stages)).toEqual(new Set())
  })

  it("is empty for no stages", () => {
    expect(findDuplicateStageIds([])).toEqual(new Set())
  })
})

describe("findDuplicateStageName", () => {
  it("returns null when there are no duplicates", () => {
    expect(findDuplicateStageName([{ name: "Wash" }, { name: "Wax" }])).toBeNull()
  })

  it("returns the (trimmed) duplicated name", () => {
    expect(findDuplicateStageName([{ name: "Wash" }, { name: "  Wash  " }])).toBe("Wash")
  })

  it("is case-insensitive", () => {
    expect(findDuplicateStageName([{ name: "wash" }, { name: "WASH" }])).toBe("WASH")
  })

  it("ignores empty names", () => {
    expect(findDuplicateStageName([{ name: "" }, { name: "" }])).toBeNull()
  })
})
