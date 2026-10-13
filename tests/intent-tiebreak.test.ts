import { describe, it, expect } from "vitest"
import {
  hasBookingIntent,
  hasStatusIntent,
  hasQuestionCue,
  mentionsOwnVehicle,
  needsIntentTiebreak,
  applyIntentTiebreak,
} from "@/lib/messenger/chatbot"

const idle = {
  quickReply: false,
  humanRequested: false,
  reportIntent: false,
  awaitingConfirmation: false,
  conflictPending: false,
  awaitingLinkVerification: false,
}

describe("hasQuestionCue", () => {
  it("recognises Filipino questions without a question mark", () => {
    for (const msg of [
      "gano katagal yung mga service",
      "ilang oras tumatagal yung service",
      "magkano ceramic coating",
      "pwede po magpa-schedule",
      "bukas ba kayo sa linggo",
    ]) {
      expect(hasQuestionCue(msg)).toBe(true)
    }
  })

  it("recognises English questions", () => {
    expect(hasQuestionCue("How long does each service take")).toBe(true)
    expect(hasQuestionCue("do you check brakes")).toBe(true)
    expect(hasQuestionCue("any update on promos?")).toBe(true)
  })

  it("is false for a plain statement", () => {
    expect(hasQuestionCue("magpa-book po ako")).toBe(false)
    expect(hasQuestionCue("I want to book")).toBe(false)
  })
})

describe("mentionsOwnVehicle", () => {
  it("is true for the customer's own vehicle, a plate, or a Job Order ID", () => {
    expect(mentionsOwnVehicle("kailan matatapos yung kotse ko")).toBe(true)
    expect(mentionsOwnVehicle("is my car ready yet")).toBe(true)
    expect(mentionsOwnVehicle("meron ba akong sasakyan diyan")).toBe(true)
    expect(mentionsOwnVehicle("status of ABC-1234?")).toBe(true)
    expect(mentionsOwnVehicle("check JO-ABCD23 please")).toBe(true)
  })

  it("is false for a general question", () => {
    expect(mentionsOwnVehicle("ilang oras yung service kung magpa-schedule ako")).toBe(false)
  })
})

describe("needsIntentTiebreak", () => {
  it("runs for a question that only happens to contain a flow keyword", () => {
    const booking = "ilang oras yung service kung magpa-schedule ako"
    const status = "pa-check po magkano ang ceramic coating"
    // Guard: these really are the keyword false positives being fixed.
    expect(hasBookingIntent(booking)).toBe(true)
    expect(hasStatusIntent(status)).toBe(true)
    expect(needsIntentTiebreak({ ...idle, message: booking })).toBe(true)
    expect(needsIntentTiebreak({ ...idle, message: status })).toBe(true)
  })

  it("does not run when no keyword fired", () => {
    expect(needsIntentTiebreak({ ...idle, message: "gano katagal yung mga service" })).toBe(false)
  })

  it("does not run for a clear booking or status request", () => {
    expect(needsIntentTiebreak({ ...idle, message: "magpa-book po ako" })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message: "kailan matatapos yung kotse ko" })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message: "status of ABC-1234?" })).toBe(false)
  })

  it("does not run for an existing-booking request, which goes to Sales", () => {
    expect(needsIntentTiebreak({ ...idle, message: "can I reschedule my appointment?" })).toBe(false)
  })

  it("does not run when contact details are in the message", () => {
    expect(needsIntentTiebreak({ ...idle, message: "pwede pa-book? 09171234567" })).toBe(false)
  })

  it("does not run on a quick reply tap, a human request, or a report", () => {
    const message = "pwede ba magpa-schedule?"
    expect(needsIntentTiebreak({ ...idle, message })).toBe(true)
    expect(needsIntentTiebreak({ ...idle, message, quickReply: true })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message, humanRequested: true })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message, reportIntent: true })).toBe(false)
  })

  it("does not run while a specific answer is awaited", () => {
    const message = "pwede ba magpa-schedule?"
    expect(needsIntentTiebreak({ ...idle, message, awaitingConfirmation: true })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message, conflictPending: true })).toBe(false)
    expect(needsIntentTiebreak({ ...idle, message, awaitingLinkVerification: true })).toBe(false)
  })
})

describe("applyIntentTiebreak", () => {
  const keyword = { booking: true, status: true }

  it("clears both intents for a question", () => {
    expect(applyIntentTiebreak(keyword, "question")).toEqual({ booking: false, status: false })
  })

  it("keeps only the intent the verdict names", () => {
    expect(applyIntentTiebreak(keyword, "booking")).toEqual({ booking: true, status: false })
    expect(applyIntentTiebreak(keyword, "status")).toEqual({ booking: false, status: true })
  })

  it("keeps the keyword result when there is no verdict", () => {
    expect(applyIntentTiebreak(keyword, null)).toEqual(keyword)
    expect(applyIntentTiebreak({ booking: true, status: false }, null)).toEqual({ booking: true, status: false })
  })
})
