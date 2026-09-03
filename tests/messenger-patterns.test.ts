import { describe, it, expect } from "vitest"
import {
  PLATE_PATTERN,
  PHONE_PATTERN,
  EMAIL_PATTERN,
  parseLinkClaim,
} from "@/lib/messenger/patterns"
import { buildLinkVerificationPrompt } from "@/lib/messenger/vehicle"
import { DEFAULT_NOT_LINKED_MESSAGE } from "@/types/chatbot"

const plate = (t: string) => t.match(PLATE_PATTERN)?.[0] ?? null
const phone = (t: string) => t.match(PHONE_PATTERN)?.[0] ?? null
const email = (t: string) => t.match(EMAIL_PATTERN)?.[0] ?? null

describe("plate + phone parsing with no separator", () => {
  // The exact message from the reported conversation. Both patterns used to end
  // on `\b`, and there is no word boundary between the "4" and the "X" — so the
  // pair parsed as nothing, the customer silently fell out of the link flow, and
  // the AI answered as though a lookup had happened.
  const glued = "09121231234XYZ-1234"

  it("reads both the phone and the plate out of a glued pair", () => {
    expect(phone(glued)).toBe("09121231234")
    expect(plate(glued)).toBe("XYZ-1234")
    expect(parseLinkClaim(glued)).toEqual({ plate: "XYZ-1234", phone: "09121231234" })
  })

  it("handles the reverse order, where a bare plate match is ambiguous", () => {
    // Matching the plate directly cannot tell where it stops and the phone
    // starts; parseLinkClaim removes the phone first, which resolves it.
    expect(plate("XYZ-123409171234567")).toBeNull()
    expect(parseLinkClaim("XYZ-123409171234567")).toEqual({
      plate: "XYZ-1234",
      phone: "09171234567",
    })
  })

  it("still reads a normally separated pair", () => {
    expect(parseLinkClaim("ABC-1234, 0917 555 0101")).toEqual({
      plate: "ABC-1234",
      phone: "0917 555 0101",
    })
    expect(parseLinkClaim("my plate is NBA 8265 and my number is 09171234567")).toEqual({
      plate: "NBA 8265",
      phone: "09171234567",
    })
  })

  it("reports an empty string for whichever half is missing", () => {
    expect(parseLinkClaim("ABC-1234")).toEqual({ plate: "ABC-1234", phone: "" })
    expect(parseLinkClaim("09171234567")).toEqual({ plate: "", phone: "09171234567" })
    expect(parseLinkClaim("hello there")).toEqual({ plate: "", phone: "" })
  })
})

describe("PHONE_PATTERN", () => {
  it("accepts the common PH mobile formats", () => {
    expect(phone("0917 555 0101")).toBe("0917 555 0101")
    expect(phone("+639175550101")).toBe("+639175550101")
    expect(phone("09171234567")).toBe("09171234567")
    expect(phone("0917-123-4567")).toBe("0917-123-4567")
  })

  it("takes the number out of a sentence", () => {
    expect(phone("my number is 09171234567 thanks")).toBe("09171234567")
  })

  it("refuses to match part of a longer digit run", () => {
    expect(phone("09171234567890")).toBeNull()
  })

  it("ignores a landline or a short number", () => {
    expect(phone("8123 4567")).toBeNull()
    expect(phone("0912345")).toBeNull()
  })
})

describe("PLATE_PATTERN", () => {
  it("accepts the common plate formats", () => {
    expect(plate("ABC 1234")).toBe("ABC 1234")
    expect(plate("XYZ-567")).toBe("XYZ-567")
    expect(plate("AAA-111")).toBe("AAA-111")
    expect(plate("my plate is NBA 8265")).toBe("NBA 8265")
  })

  it("never reads a bare phone number as a plate", () => {
    expect(plate("09171234567")).toBeNull()
    expect(plate("+639175550101")).toBeNull()
  })

  it("ignores text with no digits", () => {
    expect(plate("Ford Everest")).toBeNull()
  })
})

describe("EMAIL_PATTERN", () => {
  it("takes an address out of a sentence", () => {
    expect(email("reach me at john.doe+tag@example.co.uk please")).toBe(
      "john.doe+tag@example.co.uk"
    )
  })

  it("does not match a bare domain", () => {
    expect(email("example.com")).toBeNull()
  })
})

describe("buildLinkVerificationPrompt", () => {
  it("explains the account is not linked and routes linking to Sales", () => {
    const out = buildLinkVerificationPrompt()
    expect(out).toMatch(/isn't linked/i)
    expect(out).toMatch(/plate number/i)
    expect(out).toMatch(/sales/i)
  })

  it("shows a format example when the reply was unreadable", () => {
    const out = buildLinkVerificationPrompt({ retry: "unreadable" })
    expect(out).toContain("ABC-1234, 0917 555 0101")
    expect(out).toMatch(/couldn't read/i)
  })

  it("says the details did not match when they parsed but found nothing", () => {
    const out = buildLinkVerificationPrompt({ retry: "no_match" })
    expect(out).toMatch(/don't match/i)
    expect(out).toContain("ABC-1234, 0917 555 0101")
  })

  it("sends the admin's wording verbatim when one is configured", () => {
    const custom = "Hindi pa naka-link ang account mo. Pakisend ang plaka at numero mo."
    expect(buildLinkVerificationPrompt({ custom })).toBe(custom)
  })

  it("falls back to the default rather than sending nothing", () => {
    // A cleared settings box must never leave the customer with an empty message.
    for (const custom of ["", "   ", "\n\t ", null, undefined]) {
      expect(buildLinkVerificationPrompt({ custom })).toBe(DEFAULT_NOT_LINKED_MESSAGE)
    }
    expect(buildLinkVerificationPrompt()).toBe(DEFAULT_NOT_LINKED_MESSAGE)
  })

  it("keeps the custom wording out of the retry messages", () => {
    const custom = "CUSTOM-ONLY-TEXT"
    expect(buildLinkVerificationPrompt({ retry: "unreadable", custom })).not.toContain(custom)
    expect(buildLinkVerificationPrompt({ retry: "no_match", custom })).not.toContain(custom)
  })

  it("never claims a lookup was performed, in any variant", () => {
    for (const opts of [undefined, { retry: "unreadable" as const }, { retry: "no_match" as const }]) {
      expect(buildLinkVerificationPrompt(opts)).not.toMatch(
        /checked our system|searched|no active job order/i
      )
    }
  })

  it("emits an example that its own patterns can parse", () => {
    // Guards against the example drifting out of sync with the parser.
    expect(plate("ABC-1234, 0917 555 0101")).toBe("ABC-1234")
    expect(phone("ABC-1234, 0917 555 0101")).toBe("0917 555 0101")
  })
})
