import { describe, it, expect } from "vitest"
import { toHistoryMessages } from "@/lib/messenger/chatbot"

// getConversationHistory queries newest-first + limit so it keeps the MOST
// RECENT turns (Testing Note #9 — the loop was caused by the query returning the
// oldest 12 messages). toHistoryMessages reverses back to chronological order.

describe("toHistoryMessages", () => {
  it("reverses newest-first rows into oldest→newest and maps roles", () => {
    const rowsNewestFirst = [
      { sender_type: "agent", message_body: "Reply YES to confirm." },
      { sender_type: "customer", message_body: "my email is a@b.com" },
      { sender_type: "agent", message_body: "What is your email?" },
      { sender_type: "customer", message_body: "I want to book" },
    ]
    expect(toHistoryMessages(rowsNewestFirst)).toEqual([
      { role: "user", text: "I want to book" },
      { role: "model", text: "What is your email?" },
      { role: "user", text: "my email is a@b.com" },
      { role: "model", text: "Reply YES to confirm." },
    ])
  })

  it("treats a null body as an empty string and never mutates the input", () => {
    const input = [{ sender_type: "customer", message_body: null }]
    const out = toHistoryMessages(input)
    expect(out).toEqual([{ role: "user", text: "" }])
    expect(input[0].message_body).toBeNull()
  })

  it("returns an empty array for no rows", () => {
    expect(toHistoryMessages([])).toEqual([])
  })
})
