import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { verifyTurnstileToken } from "@/lib/auth/turnstile"

const originalSecret = process.env.TURNSTILE_SECRET_KEY

beforeEach(() => {
  process.env.TURNSTILE_SECRET_KEY = "test-secret"
  vi.restoreAllMocks()
})

afterEach(() => {
  process.env.TURNSTILE_SECRET_KEY = originalSecret
})

describe("verifyTurnstileToken", () => {
  it("returns true on a successful verification", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    await expect(verifyTurnstileToken("good-token")).resolves.toBe(true)
  })

  it("returns false when Cloudflare reports failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
    })
    await expect(verifyTurnstileToken("bad-token")).resolves.toBe(false)
  })

  it("returns false when the HTTP response itself isn't ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(verifyTurnstileToken("token")).resolves.toBe(false)
  })

  it("returns false (not throw) on a network error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    global.fetch = vi.fn().mockRejectedValue(new Error("network down"))
    await expect(verifyTurnstileToken("token")).resolves.toBe(false)
    expect(spy).toHaveBeenCalled()
  })

  it("fails closed when TURNSTILE_SECRET_KEY isn't configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    global.fetch = vi.fn()
    await expect(verifyTurnstileToken("token")).resolves.toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
  })
})
