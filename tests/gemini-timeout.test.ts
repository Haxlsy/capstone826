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

// Confirmed in production: Gemini returned 503 ("This model is currently
// experiencing high demand... Please try again later.") — its own wording
// for "transient, just retry," not a real failure worth escalating a
// customer to Sales over.
const retryableError = (status: number) => Object.assign(new Error("transient"), { status })

describe("Gemini calls retry once on a transient 503/429", () => {
  it("retries after a 503 and returns the successful result", async () => {
    generateContent
      .mockRejectedValueOnce(retryableError(503))
      .mockResolvedValueOnce({ text: JSON.stringify({ reply: "ok", escalate: false, customer: {} }) })
    const { generateChatbotReply } = await import("@/lib/messenger/chatbot")

    vi.useFakeTimers()
    const promise = generateChatbotReply({ message: "hello" })
    await vi.advanceTimersByTimeAsync(1_500)
    const result = await promise
    vi.useRealTimers()

    expect(result.reply).toBe("ok")
    expect(generateContent).toHaveBeenCalledTimes(2)
  })

  it("still fails (and degrades to null) once the single retry is also 429", async () => {
    generateContent.mockRejectedValue(retryableError(429))
    const { extractCustomerDetails } = await import("@/lib/messenger/chatbot")

    vi.useFakeTimers()
    const promise = extractCustomerDetails({ message: "test" })
    await vi.advanceTimersByTimeAsync(1_500)
    await expect(promise).resolves.toBeNull()
    vi.useRealTimers()

    expect(generateContent).toHaveBeenCalledTimes(2) // original + the one retry, no more
  })

  it("does not retry a non-retryable error (e.g. the 400 invalid-deadline shape)", async () => {
    generateContent.mockRejectedValueOnce(retryableError(400))
    const { extractCustomerDetails } = await import("@/lib/messenger/chatbot")

    await expect(extractCustomerDetails({ message: "test" })).resolves.toBeNull()
    expect(generateContent).toHaveBeenCalledTimes(1)
  })
})
