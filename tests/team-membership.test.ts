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
  it("works for crew (ids only in substituteIds)", () => {
    expect(alreadyOnJob("t1", { substituteIds: ["t1", "t2"] })).toBe("substitute")
    expect(alreadyOnJob("t3", { substituteIds: ["t1", "t2"] })).toBeNull()
  })
  it("flags any of several crew primaries via primaryIds", () => {
    const crewTeam = { primaryIds: ["c1", "c2"], substituteIds: ["c3"] }
    expect(alreadyOnJob("c1", crewTeam)).toBe("primary")
    expect(alreadyOnJob("c2", crewTeam)).toBe("primary")
    expect(alreadyOnJob("c3", crewTeam)).toBe("substitute")
    expect(alreadyOnJob("c4", crewTeam)).toBeNull()
  })
})
