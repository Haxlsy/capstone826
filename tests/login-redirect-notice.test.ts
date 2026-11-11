import { describe, it, expect } from "vitest"
import { isLoginRedirectNotice, loginRedirectNoticeCopy } from "@/lib/auth/login-redirect-notice"

describe("isLoginRedirectNotice", () => {
  it("recognizes every reason the login page explains", () => {
    expect(isLoginRedirectNotice("signed_in_elsewhere")).toBe(true)
    expect(isLoginRedirectNotice("session_expired")).toBe(true)
    expect(isLoginRedirectNotice("idle_timeout")).toBe(true)
    expect(isLoginRedirectNotice("account_archived")).toBe(true)
  })

  it("rejects anything else, including null/undefined from a missing query param", () => {
    expect(isLoginRedirectNotice(null)).toBe(false)
    expect(isLoginRedirectNotice(undefined)).toBe(false)
    expect(isLoginRedirectNotice("")).toBe(false)
    expect(isLoginRedirectNotice("forbidden_role")).toBe(false)
    expect(isLoginRedirectNotice("mismatch")).toBe(false)
  })
})

describe("loginRedirectNoticeCopy", () => {
  it("has distinct, human wording for each reason", () => {
    const reasons = ["signed_in_elsewhere", "session_expired", "idle_timeout", "account_archived"] as const
    const copies = reasons.map(loginRedirectNoticeCopy)
    expect(new Set(copies).size).toBe(reasons.length)
    for (const c of copies) expect(c.length).toBeGreaterThan(0)
  })

  it("names the actual cause for the two most specific reasons", () => {
    expect(loginRedirectNoticeCopy("signed_in_elsewhere")).toMatch(/another device/i)
    expect(loginRedirectNoticeCopy("account_archived")).toMatch(/archived/i)
  })
})
