import { describe, it, expect } from "vitest"
import { isTransientMailError } from "@/lib/email/mailer"

const smtpError = (responseCode: number, code = "EMESSAGE") =>
  Object.assign(new Error(`Data command failed: ${responseCode}`), { responseCode, code })

describe("isTransientMailError", () => {
  it("retries Gmail's 421 Temporary System Problem", () => {
    expect(isTransientMailError(smtpError(421))).toBe(true)
  })

  it("retries other temporary SMTP replies", () => {
    for (const c of [450, 451, 452, 454]) expect(isTransientMailError(smtpError(c))).toBe(true)
  })

  it("retries a connection that failed before any reply", () => {
    for (const code of ["ETIMEDOUT", "ECONNECTION", "ECONNRESET", "ESOCKET", "EDNS"]) {
      expect(isTransientMailError(Object.assign(new Error("net"), { code }))).toBe(true)
    }
  })

  it("does not retry a permanent rejection", () => {
    expect(isTransientMailError(smtpError(535, "EAUTH"))).toBe(false)
    expect(isTransientMailError(smtpError(550))).toBe(false)
    expect(isTransientMailError(Object.assign(new Error("auth"), { code: "EAUTH" }))).toBe(false)
  })

  it("does not retry an unrecognised error or a non-error", () => {
    expect(isTransientMailError(new Error("boom"))).toBe(false)
    expect(isTransientMailError("421")).toBe(false)
    expect(isTransientMailError(null)).toBe(false)
    expect(isTransientMailError(undefined)).toBe(false)
  })
})
