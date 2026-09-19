import { describe, it, expect } from "vitest"
import { alreadyOnJob } from "@/lib/operations/team-membership"

describe("alreadyOnJob", () => {
  const team = { primaryId: "p", substituteIds: ["s1", "s2"] }
  it("flags the assigned head as primary", () => expect(alreadyOnJob("p", team)).toBe("primary"))
  it("flags existing substitutes", () => expect(alreadyOnJob("s2", team)).toBe("substitute"))
  it("returns null for anyone else", () => expect(alreadyOnJob("x", team)).toBeNull())
  it("handles an unassigned primary and no substitutes", () => {
    expect(alreadyOnJob("x", { primaryId: null })).toBeNull()
    expect(alreadyOnJob("x", {})).toBeNull()
  })
})
