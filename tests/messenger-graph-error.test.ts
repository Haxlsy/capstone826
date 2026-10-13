import { describe, it, expect } from "vitest"
import { classifyGraphError, describeSendError } from "@/lib/messenger/graph"

const err = (code: number, error_subcode?: number, message = "msg") => ({ error: { code, error_subcode, message } })

describe("classifyGraphError", () => {
  it("recognises a closed 24-hour window", () => {
    expect(classifyGraphError(err(10, 2018278)).kind).toBe("window_closed")
    expect(classifyGraphError(err(1545041)).kind).toBe("window_closed")
    expect(classifyGraphError(err(100, 1545041)).kind).toBe("window_closed")
  })

  it("recognises an expired or invalid token", () => {
    expect(classifyGraphError(err(190, 463)).kind).toBe("token")
  })

  it("recognises a permission problem", () => {
    expect(classifyGraphError(err(10)).kind).toBe("permission")
    expect(classifyGraphError(err(200, 1545012)).kind).toBe("permission")
  })

  it("keeps the code, subcode and message", () => {
    expect(classifyGraphError(err(190, 463, "Session has expired"))).toEqual({
      kind: "token", code: 190, subcode: 463, message: "Session has expired",
    })
  })

  it("falls back to unknown for anything else, including an empty body", () => {
    expect(classifyGraphError(err(613)).kind).toBe("unknown")
    expect(classifyGraphError(null).kind).toBe("unknown")
    expect(classifyGraphError({}).kind).toBe("unknown")
    expect(classifyGraphError("not json").kind).toBe("unknown")
  })
})

describe("describeSendError", () => {
  it("tells staff what to do when the window is closed", () => {
    expect(describeSendError(classifyGraphError(err(10, 2018278)))).toMatch(/24 hours/)
  })

  it("has a generic message when the reason is unknown", () => {
    expect(describeSendError(null)).toBe("Messenger API returned an error.")
    expect(describeSendError(classifyGraphError(err(613)))).toBe("Messenger API returned an error.")
  })
})
