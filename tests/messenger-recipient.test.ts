import { describe, it, expect } from "vitest"
import { pickRecipientPsid } from "@/lib/messenger/recipient"

describe("pickRecipientPsid", () => {
  it("prefers the record's own psid", () => {
    expect(pickRecipientPsid({ own: "own", notify: "n", siblingPsids: ["s"] })).toBe("own")
  })
  it("uses notify_psid when the record has no psid of its own", () => {
    expect(pickRecipientPsid({ own: null, notify: "n", siblingPsids: ["s"] })).toBe("n")
  })
  it("uses a same-phone sibling's psid when there is exactly one", () => {
    expect(pickRecipientPsid({ own: null, notify: null, siblingPsids: ["s"] })).toBe("s")
    expect(pickRecipientPsid({ own: null, notify: null, siblingPsids: ["s", "s"] })).toBe("s")
  })
  it("never guesses between different siblings' psids", () => {
    expect(pickRecipientPsid({ own: null, notify: null, siblingPsids: ["a", "b"] })).toBeNull()
  })
  it("returns null when nothing identifies a recipient", () => {
    expect(pickRecipientPsid({ own: null, notify: null, siblingPsids: [] })).toBeNull()
    expect(pickRecipientPsid({ own: "", notify: undefined, siblingPsids: [null, undefined] })).toBeNull()
  })
})
