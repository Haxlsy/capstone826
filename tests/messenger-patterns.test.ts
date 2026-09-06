import { describe, it, expect } from "vitest"
import {
  PLATE_PATTERN,
  PHONE_PATTERN,
  EMAIL_PATTERN,
  parseLinkClaim,
  extractJobOrderCode,
} from "@/lib/messenger/patterns"
import { buildLinkVerificationPrompt } from "@/lib/messenger/vehicle"
import { resolveTemplate, detectMessageLanguage, quickReplyLabel, offTopicRedirect, reportConfirmationPrompt, reportDeclinedAck } from "@/lib/messenger/copy"
import { quickRepliesFor } from "@/lib/messenger/handoff"
import {
  DEFAULT_VEHICLE_STATUS_MESSAGE_EN,
  DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  DEFAULT_LINK_VERIFICATION_MESSAGE_EN,
  DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
} from "@/types/chatbot"

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

  // Regression: an off-topic logic-puzzle message got misread as containing a
  // plate ("is 25", "is 23", "of 826"), which hijacked the reply into the
  // deterministic booking flow instead of letting the AI see it as off-topic.
  it("does not misread an ordinary sentence's short connector words as a plate", () => {
    expect(plate("John is 25 years old. Mary is older than John. Mary is 23 years old.")).toBeNull()
    expect(plate("A bat and a ball cost 110 total. Who is owner of 826?")).toBeNull()
    expect(plate("I'll be there at 5 to pick up my car")).toBeNull()
  })

  it("still finds a real plate elsewhere in a sentence containing those words", () => {
    expect(plate("is my plate ABC 1234 on file?")).toBe("ABC 1234")
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

describe("JOB_ORDER_CODE_PATTERN / extractJobOrderCode", () => {
  it("reads a code out of a sentence and normalizes to uppercase", () => {
    expect(extractJobOrderCode("my job order code is jo-8x2k9f thanks")).toBe("JO-8X2K9F")
    expect(extractJobOrderCode("JO-8X2K9F")).toBe("JO-8X2K9F")
  })

  it("returns empty string when no code is present", () => {
    expect(extractJobOrderCode("hello there")).toBe("")
    expect(extractJobOrderCode("ABC-1234, 0917 555 0101")).toBe("")
  })
})

describe("resolveTemplate", () => {
  it("falls back to the default rather than sending nothing", () => {
    // A cleared admin field must never leave the customer with an empty message.
    for (const blank of ["", "   ", "\n\t ", null, undefined]) {
      expect(resolveTemplate(blank, blank, "fallback en", "fallback fil")).toEqual({
        en: "fallback en",
        fil: "fallback fil",
      })
    }
  })

  it("uses the admin value when actually filled in", () => {
    expect(resolveTemplate("custom en", "custom fil", "fallback en", "fallback fil")).toEqual({
      en: "custom en",
      fil: "custom fil",
    })
  })
})

describe("buildLinkVerificationPrompt", () => {
  it("explains the account is not linked and asks for the Job Order Code", () => {
    const out = buildLinkVerificationPrompt({})
    expect(out).toMatch(/isn't linked/i)
    expect(out).toMatch(/job order code/i)
  })

  it("falls back to the built-in default when no template is given", () => {
    expect(buildLinkVerificationPrompt({})).toBe(DEFAULT_VEHICLE_STATUS_MESSAGE_EN)
    expect(buildLinkVerificationPrompt({ lang: "filipino" })).toBe(DEFAULT_VEHICLE_STATUS_MESSAGE_FIL)
    expect(buildLinkVerificationPrompt({ retry: "unrecognized" })).toBe(DEFAULT_LINK_VERIFICATION_MESSAGE_EN)
    expect(buildLinkVerificationPrompt({ retry: "unrecognized", lang: "filipino" })).toBe(DEFAULT_LINK_VERIFICATION_MESSAGE_FIL)
  })

  it("shows a format example when the code was unrecognized", () => {
    const out = buildLinkVerificationPrompt({ retry: "unrecognized" })
    expect(out).toContain("JO-8X2K9F")
    expect(out).toMatch(/couldn't verify/i)
  })

  it("never reveals WHY verification failed — no code enumeration oracle", () => {
    // The same message is sent whether the code does not exist or it is already
    // linked to somebody else's Messenger account. Any wording that separated
    // those cases would let an attacker probe codes and learn which are valid.
    const unrecognized = buildLinkVerificationPrompt({ retry: "unrecognized" })
    const conflict = buildLinkVerificationPrompt({ retry: "conflict" })
    expect(unrecognized).toBe(conflict)
    expect(unrecognized).not.toMatch(
      /already (?:linked|registered|claimed|taken)|another account|someone else|belongs to|different (?:account|customer)|impersonat/i
    )
    // Nor may it confirm the opposite — that no such record exists.
    expect(unrecognized).not.toMatch(/no (?:such )?(?:record|account|customer)|not found|doesn't exist/i)
  })

  it("sends the admin's wording verbatim when one is configured", () => {
    const vehicleStatusTemplate = { en: "Hindi pa naka-link ang account mo.", fil: "FIL VERSION" }
    expect(buildLinkVerificationPrompt({ vehicleStatusTemplate })).toBe(vehicleStatusTemplate.en)
    expect(buildLinkVerificationPrompt({ vehicleStatusTemplate, lang: "filipino" })).toBe(vehicleStatusTemplate.fil)
  })

  it("keeps the vehicle-status template out of the retry messages", () => {
    const vehicleStatusTemplate = { en: "CUSTOM-ONLY-TEXT", fil: "CUSTOM-ONLY-TEXT-FIL" }
    expect(buildLinkVerificationPrompt({ retry: "unrecognized", vehicleStatusTemplate })).not.toContain("CUSTOM-ONLY-TEXT")
    expect(buildLinkVerificationPrompt({ retry: "conflict", vehicleStatusTemplate })).not.toContain("CUSTOM-ONLY-TEXT")
  })

  it("never claims a lookup was performed, in any variant", () => {
    for (const opts of [{}, { retry: "unrecognized" as const }, { retry: "conflict" as const }]) {
      expect(buildLinkVerificationPrompt(opts)).not.toMatch(
        /checked our system|searched|no active job order/i
      )
    }
  })

  it("emits an example that its own pattern can parse", () => {
    // Guards against the example drifting out of sync with the parser.
    expect(extractJobOrderCode("JO-8X2K9F")).toBe("JO-8X2K9F")
  })
})

describe("detectMessageLanguage", () => {
  it("reads plain English as english", () => {
    expect(detectMessageLanguage("how much is ceramic coating")).toBe("english")
  })

  it("reads plain Filipino as filipino", () => {
    expect(detectMessageLanguage("magkano po ang ceramic coating")).toBe("filipino")
  })

  it("reads Taglish carrying a Filipino particle as filipino", () => {
    expect(detectMessageLanguage("pwede po ba mag book ngayon")).toBe("filipino")
  })

  it("falls back to english for empty or missing text", () => {
    expect(detectMessageLanguage("")).toBe("english")
    expect(detectMessageLanguage(null)).toBe("english")
    expect(detectMessageLanguage(undefined)).toBe("english")
  })
})

describe("quickReplyLabel — \"both\" language", () => {
  it("uses English titles when the detected language is english", () => {
    expect(quickReplyLabel("services", "both", "english")).toBe("Services & Prices")
  })

  it("uses Filipino titles when the detected language is filipino", () => {
    expect(quickReplyLabel("services", "both", "filipino")).toBe("Serbisyo at Presyo")
  })

  it("falls back to Filipino when no detected language is supplied", () => {
    expect(quickReplyLabel("services", "both")).toBe("Serbisyo at Presyo")
  })

  it("ignores the detected language entirely outside of \"both\"", () => {
    expect(quickReplyLabel("services", "english", "filipino")).toBe("Services & Prices")
    expect(quickReplyLabel("services", "filipino", "english")).toBe("Serbisyo at Presyo")
  })
})

describe("quickRepliesFor — \"both\" language picks up the customer's last message", () => {
  it("renders English button titles after an English message", () => {
    const menu = quickRepliesFor("both", "how much is ceramic coating")
    expect(menu.find((m) => m.payload === "services")?.title).toBe("Services & Prices")
  })

  it("renders Filipino button titles after a Filipino message", () => {
    const menu = quickRepliesFor("both", "magkano po ang ceramic coating")
    expect(menu.find((m) => m.payload === "services")?.title).toBe("Serbisyo at Presyo")
  })

  it("falls back to Filipino when there is no last customer message to read", () => {
    const menu = quickRepliesFor("both", undefined)
    expect(menu.find((m) => m.payload === "services")?.title).toBe("Serbisyo at Presyo")
  })
})

describe("offTopicRedirect", () => {
  it("renders English only for the english setting", () => {
    const text = offTopicRedirect("english")
    expect(text).toBe("I can only assist with questions about 826 Auto Care's services. Is there anything I can help you with regarding our services?")
  })

  it("renders Filipino only for the filipino setting", () => {
    const text = offTopicRedirect("filipino")
    expect(text).toBe("Makakatulong lang po ako sa mga tanong tungkol sa mga serbisyo ng 826 Auto Care. May maitutulong ba ako sa inyo may kinalaman sa aming mga serbisyo?")
  })

  it("concatenates English then Filipino for the both setting", () => {
    const text = offTopicRedirect("both")
    expect(text).toContain("I can only assist with questions about 826 Auto Care's services")
    expect(text).toContain("Makakatulong lang po ako")
    expect(text.indexOf("I can only assist")).toBeLessThan(text.indexOf("Makakatulong"))
  })
})

describe("reportConfirmationPrompt / reportDeclinedAck", () => {
  it("asks to confirm in English, Filipino, and both", () => {
    expect(reportConfirmationPrompt("english")).toMatch(/report this as a concern/i)
    expect(reportConfirmationPrompt("filipino")).toMatch(/i-report ko ito/i)
    const both = reportConfirmationPrompt("both")
    expect(both).toMatch(/report this as a concern/i)
    expect(both).toMatch(/i-report ko ito/i)
  })

  it("acknowledges a decline in English, Filipino, and both", () => {
    expect(reportDeclinedAck("english")).toMatch(/no problem/i)
    expect(reportDeclinedAck("filipino")).toMatch(/walang problema/i)
    const both = reportDeclinedAck("both")
    expect(both).toMatch(/no problem/i)
    expect(both).toMatch(/walang problema/i)
  })
})
