import { describe, it, expect } from "vitest"
import { shouldResumeBot, QUICK_REPLIES, MESSAGING_WINDOW_MS } from "@/lib/messenger/handoff"

const NOW = new Date("2026-09-03T12:00:00.000Z")

/** An ISO timestamp `hours` before NOW. */
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()

const decide = (over: Partial<Parameters<typeof shouldResumeBot>[0]> = {}) =>
  shouldResumeBot({
    conversationStatus: "pending",
    openInquiryCount: 0,
    lastCustomerMessageAt: hoursAgo(1),
    now: NOW,
    ...over,
  })

describe("shouldResumeBot — handing a concluded handoff back to the bot", () => {
  it("resumes and pushes the menu inside the 24h messaging window", () => {
    const d = decide()
    expect(d.resume).toBe(true)
    expect(d.canPush).toBe(true)
  })

  it("resumes but skips the push outside the 24h messaging window", () => {
    const d = decide({ lastCustomerMessageAt: hoursAgo(30) })
    expect(d.resume).toBe(true)
    expect(d.canPush).toBe(false)
  })

  it("treats a conversation with no customer message as un-pushable", () => {
    const d = decide({ lastCustomerMessageAt: null })
    expect(d.resume).toBe(true)
    expect(d.canPush).toBe(false)
  })

  it("does not push twice when the inquiry is resolved again", () => {
    // The first resume already moved the conversation to 'closed'.
    const d = decide({ conversationStatus: "closed" })
    expect(d.resume).toBe(false)
    expect(d.canPush).toBe(false)
  })

  it("does not resume a conversation the bot already owns", () => {
    expect(decide({ conversationStatus: "open" }).resume).toBe(false)
  })

  it("does not resume when the conversation is missing", () => {
    expect(decide({ conversationStatus: null }).resume).toBe(false)
  })

  it("keeps the thread with the human while another inquiry is still open", () => {
    const d = decide({ openInquiryCount: 1 })
    expect(d.resume).toBe(false)
    expect(d.canPush).toBe(false)
  })

  it("holds the window boundary — just inside pushes, just outside does not", () => {
    const justInside = new Date(NOW.getTime() - MESSAGING_WINDOW_MS + 1000).toISOString()
    const justOutside = new Date(NOW.getTime() - MESSAGING_WINDOW_MS - 1000).toISOString()
    expect(decide({ lastCustomerMessageAt: justInside }).canPush).toBe(true)
    expect(decide({ lastCustomerMessageAt: justOutside }).canPush).toBe(false)
  })

  it("gives a reason on every outcome", () => {
    expect(decide().reason).toBeTruthy()
    expect(decide({ conversationStatus: "closed" }).reason).toBeTruthy()
    expect(decide({ openInquiryCount: 2 }).reason).toContain("2")
  })
})

describe("QUICK_REPLIES — the shared menu", () => {
  it("carries the four payloads the webhook branches on", () => {
    expect(QUICK_REPLIES.map((q) => q.payload)).toEqual([
      "services",
      "booking",
      "report",
      "status",
    ])
  })

  it("stays within Messenger's 13-reply / 20-char-title limits", () => {
    expect(QUICK_REPLIES.length).toBeLessThanOrEqual(13)
    for (const q of QUICK_REPLIES) {
      expect(q.content_type).toBe("text")
      expect(q.title.length).toBeLessThanOrEqual(20)
    }
  })
})
