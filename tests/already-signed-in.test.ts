import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { isAlreadySignedIn, checkAlreadySignedIn } from "@/lib/auth/already-signed-in"

const respond = (body: unknown, ok = true) =>
  vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch

describe("isAlreadySignedIn", () => {
  it("is true only for a valid session", () => {
    expect(isAlreadySignedIn({ valid: true })).toBe(true)
  })

  it("is false for every other status the endpoint can return", () => {
    for (const s of [
      { valid: false, reason: "mismatch" },
      { valid: false, reason: "archived" },
      { valid: false, reason: "no_session" },
      null,
      undefined,
      "valid",
      { valid: "true" },
      {},
    ]) {
      expect(isAlreadySignedIn(s)).toBe(false)
    }
  })
})

describe("checkAlreadySignedIn", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("resolves true for a live session and false for a signed-out one", async () => {
    expect(await checkAlreadySignedIn(respond({ valid: true }), 1500)).toBe(true)
    expect(await checkAlreadySignedIn(respond({ valid: false, reason: "no_session" }), 1500)).toBe(false)
  })

  // Fails open: the check may delay the login form but must never lock
  // anyone out of it.
  it("fails open on a non-OK response or a network error", async () => {
    expect(await checkAlreadySignedIn(respond({ valid: true }, false), 1500)).toBe(false)
    expect(await checkAlreadySignedIn(vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch, 1500)).toBe(false)
  })

  it("aborts a check that never resolves at the timeout and fails open", async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
      }),
    ) as unknown as typeof fetch

    const pending = checkAlreadySignedIn(hang, 1500)
    await vi.advanceTimersByTimeAsync(1500)
    expect(await pending).toBe(false)
  })
})
