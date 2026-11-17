import { describe, it, expect, vi, beforeEach } from "vitest"
import { resolveTurnLanguage } from "@/lib/messenger/copy"

// Reported: a customer who opened in Tagalog and then wrote in English kept
// getting Tagalog AI replies. The fixed replies already followed each
// message's language (resolveTurnLanguage); the AI was never told it and
// followed the Tagalog history instead. These check the language now reaches
// the AI's instructions.
const generateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({ reply: "ok", escalate: false, customer: {} }),
})

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI(this: { models: unknown }) {
    this.models = { generateContent }
  }),
}))

beforeEach(() => generateContent.mockClear())

async function promptFor(replyLanguage?: "english" | "filipino") {
  const { generateChatbotReply } = await import("@/lib/messenger/chatbot")
  await generateChatbotReply({
    message: "do you have any customer records",
    history: [
      { role: "user", text: "anong oras po kayo bukas?" },
      { role: "model", text: "Ay sige po! Bukas kami 8:00 AM to 6:00 PM." },
    ],
    replyLanguage,
  })
  return generateContent.mock.calls[0][0].config.systemInstruction as string
}

describe("AI reply language", () => {
  it("tells the AI to reply in English for an English message after a Tagalog start", async () => {
    const prompt = await promptFor("english")
    expect(prompt).toContain("REPLY LANGUAGE: The customer's latest message is in English.")
    expect(prompt).not.toContain("latest message is in Filipino")
  })

  it("tells the AI to reply in Filipino for a Filipino message", async () => {
    const prompt = await promptFor("filipino")
    expect(prompt).toContain("REPLY LANGUAGE: The customer's latest message is in Filipino.")
  })

  it("adds nothing when no language is given (old behaviour)", async () => {
    expect(await promptFor()).not.toContain("REPLY LANGUAGE:")
  })

  it("resolves the reported messages the way the webhook passes them", () => {
    const earlier = ["anong oras po kayo bukas?"]
    expect(resolveTurnLanguage("can you access the all the services i've done", earlier)).toBe("english")
    expect(resolveTurnLanguage("do you have any customer records", earlier)).toBe("english")
    expect(resolveTurnLanguage("anong oras po kayo bukas?", [])).toBe("filipino")
    // A message with no language keeps the conversation's last one.
    expect(resolveTurnLanguage("ok", ["do you have any customer records"])).toBe("english")
  })
})
