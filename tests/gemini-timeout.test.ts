import { describe, it, expect, vi, beforeEach } from "vitest"

// A hang (not an error) on either Gemini call used to leave the customer on
// the typing indicator forever, with no fallback ever sent — see
// lib/messenger/chatbot.ts's GEMINI_CALL_TIMEOUT_MS comment. This asserts the
// fix is actually wired up: both calls pass a bounded httpOptions.timeout,
// so a hang throws (which the existing catch/escalate path already handles)
// instead of blocking indefinitely.
const generateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({ reply: "ok", escalate: false, customer: {} }),
})

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI(this: { models: unknown }) {
    this.models = { generateContent }
  }),
}))

beforeEach(() => {
  generateContent.mockClear()
})

describe("Gemini calls set a bounded timeout", () => {
  it("generateChatbotReply passes httpOptions.timeout", async () => {
    const { generateChatbotReply } = await import("@/lib/messenger/chatbot")
    await generateChatbotReply({ message: "hello" })

    expect(generateContent).toHaveBeenCalledTimes(1)
    const call = generateContent.mock.calls[0][0]
    expect(call.config.httpOptions?.timeout).toBeTypeOf("number")
    // Regression: Gemini's API rejects any deadline under 10s outright (a
    // production 400 confirmed this — see the constant's own comment in
    // lib/messenger/chatbot.ts) — a shorter "timeout" isn't a fast bound,
    // it's a guaranteed failure on every single call.
    expect(call.config.httpOptions.timeout).toBeGreaterThanOrEqual(10_000)
  })

  it("extractCustomerDetails passes httpOptions.timeout", async () => {
    generateContent.mockResolvedValueOnce({ text: JSON.stringify({ customer: {} }) })
    const { extractCustomerDetails } = await import("@/lib/messenger/chatbot")
    await extractCustomerDetails({ message: "Juan, 09171234567" })

    expect(generateContent).toHaveBeenCalledTimes(1)
    const call = generateContent.mock.calls[0][0]
    expect(call.config.httpOptions?.timeout).toBeTypeOf("number")
    expect(call.config.httpOptions.timeout).toBeGreaterThanOrEqual(10_000)
  })

  it("a hung/aborted call is not left unhandled — extractCustomerDetails degrades to null", async () => {
    generateContent.mockRejectedValueOnce(new Error("The user aborted a request"))
    const { extractCustomerDetails } = await import("@/lib/messenger/chatbot")
    await expect(extractCustomerDetails({ message: "test" })).resolves.toBeNull()
  })
})
