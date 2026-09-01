import { describe, it, expect } from "vitest"
import { nextViolationState } from "@/lib/messenger/chatbot"

// Graduated off-topic / policy-violation counter (Testing Notes #6, #7).
// Off-topic: warn on the 4th consecutive turn, escalate on the 5th.
// Policy/safety: warn on the 1st, escalate on the 2nd.

const zero = { offtopic: 0, policy: 0 }

describe("nextViolationState — off-topic ladder", () => {
  it("no action for the first three off-topic turns", () => {
    let s = nextViolationState(zero, "off_topic")
    expect(s).toEqual({ offtopic: 1, policy: 0, action: "none" })
    s = nextViolationState(s, "off_topic")
    expect(s).toEqual({ offtopic: 2, policy: 0, action: "none" })
    s = nextViolationState(s, "off_topic")
    expect(s).toEqual({ offtopic: 3, policy: 0, action: "none" })
  })

  it("warns on the 4th and escalates on the 5th", () => {
    const four = nextViolationState({ offtopic: 3, policy: 0 }, "off_topic")
    expect(four).toEqual({ offtopic: 4, policy: 0, action: "warn" })
    const five = nextViolationState({ offtopic: 4, policy: 0 }, "off_topic")
    expect(five).toEqual({ offtopic: 5, policy: 0, action: "escalate" })
  })
})

describe("nextViolationState — policy ladder", () => {
  it("warns on the 1st policy violation and escalates on the 2nd", () => {
    const one = nextViolationState(zero, "policy")
    expect(one).toEqual({ offtopic: 0, policy: 1, action: "warn" })
    const two = nextViolationState({ offtopic: 0, policy: 1 }, "policy")
    expect(two).toEqual({ offtopic: 0, policy: 2, action: "escalate" })
  })
})

describe("nextViolationState — resets", () => {
  it("a valid on-topic message clears both streaks", () => {
    expect(nextViolationState({ offtopic: 4, policy: 0 }, "none")).toEqual({
      offtopic: 0,
      policy: 0,
      action: "none",
    })
  })

  it("switching violation type resets the other counter", () => {
    const afterOfftopic = nextViolationState({ offtopic: 3, policy: 0 }, "off_topic")
    expect(afterOfftopic.offtopic).toBe(4)
    const thenPolicy = nextViolationState(afterOfftopic, "policy")
    expect(thenPolicy).toEqual({ offtopic: 0, policy: 1, action: "warn" })
  })
})
