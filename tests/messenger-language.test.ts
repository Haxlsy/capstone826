import { describe, it, expect } from "vitest"
import { resolveTurnLanguage, detectMessageLanguage, QUICK_REPLY_LABELS } from "@/lib/messenger/copy"
import { quickRepliesFor } from "@/lib/messenger/handoff"

const TAGALOG = "Magkano po ang ceramic coating"
const ENGLISH = "How much is the ceramic coating"

describe("resolveTurnLanguage: a message that says which language it is", () => {
  it("reads Filipino and Taglish as Filipino", () => {
    expect(resolveTurnLanguage(TAGALOG)).toBe("filipino")
    expect(resolveTurnLanguage("pwede po ba mag book ngayon")).toBe("filipino")
  })

  it("reads common Tagalog the old word list missed", () => {
    for (const text of ["Kumusta", "Magandang umaga", "Kelan matatapos kotse ko", "Nasaan na yung kotse", "Magpapa-detail sana ako"]) {
      expect(resolveTurnLanguage(text)).toBe("filipino")
    }
  })

  it("reads an English sentence as English", () => {
    expect(resolveTurnLanguage(ENGLISH)).toBe("english")
    expect(resolveTurnLanguage("I may book at 3pm")).toBe("english")
    expect(resolveTurnLanguage("Can you check my car")).toBe("english")
  })

  it("lets a customer switch language mid-conversation", () => {
    expect(resolveTurnLanguage(ENGLISH, [TAGALOG])).toBe("english")
    expect(resolveTurnLanguage(TAGALOG, [ENGLISH])).toBe("filipino")
  })
})

describe("resolveTurnLanguage: tapping a quick-reply button", () => {
  it("keeps the language of the button that was tapped", () => {
    for (const label of Object.values(QUICK_REPLY_LABELS)) {
      expect(resolveTurnLanguage(label.filipino, [ENGLISH])).toBe("filipino")
      expect(resolveTurnLanguage(label.english, [TAGALOG])).toBe("english")
    }
  })

  it("keeps Filipino after tapping 'Serbisyo at Presyo' (it used to flip to English)", () => {
    expect(resolveTurnLanguage("Serbisyo at Presyo", [TAGALOG])).toBe("filipino")
  })
})

describe("resolveTurnLanguage: a message with no language in it", () => {
  const neutral = ["ok", "OK!", "yes", "hello", "ABC 1234", "09171234567", "Juan Dela Cruz", "Toyota Vios 2020", "juan@example.com", "👍", "[Attachment]"]

  it("stays Filipino after a Tagalog message", () => {
    for (const text of neutral) expect(resolveTurnLanguage(text, [TAGALOG])).toBe("filipino")
  })

  it("stays English after an English message", () => {
    for (const text of neutral) expect(resolveTurnLanguage(text, [ENGLISH])).toBe("english")
  })

  it("looks past other neutral messages to the last one that had a language", () => {
    expect(resolveTurnLanguage("ok", [ENGLISH, TAGALOG, "ABC 1234", "09171234567"])).toBe("filipino")
    expect(resolveTurnLanguage("ok", [TAGALOG, ENGLISH, "yes"])).toBe("english")
  })

  it("defaults to English when the conversation has no signal at all", () => {
    expect(resolveTurnLanguage("ok")).toBe("english")
    expect(resolveTurnLanguage("ABC 1234", ["hello", null, ""])).toBe("english")
    expect(resolveTurnLanguage(null)).toBe("english")
    expect(resolveTurnLanguage("")).toBe("english")
  })
})

describe("the widened Filipino word list does not misfire on English", () => {
  it("still reads plain English as English", () => {
    const english = [
      "how much is ceramic coating",
      "I want to book a full detailing for my sedan tomorrow",
      "What time do you open on Saturday",
      "Is my car ready for pickup",
      "Please send me the price list",
      "Do you have paint protection film",
      "There is a scratch on the left door",
    ]
    for (const text of english) {
      expect(detectMessageLanguage(text)).toBe("english")
      expect(resolveTurnLanguage(text, [TAGALOG])).toBe("english")
    }
  })
})

describe("buttons follow the resolved language", () => {
  it("shows Filipino buttons through a tap and a neutral reply in a Tagalog chat", () => {
    const turns = [TAGALOG, "Serbisyo at Presyo", "ok", "ABC 1234"]
    turns.forEach((text, i) => {
      const lang = resolveTurnLanguage(text, turns.slice(0, i))
      expect(quickRepliesFor(lang).map((q) => q.title)).toEqual(Object.values(QUICK_REPLY_LABELS).map((l) => l.filipino))
    })
  })
})
