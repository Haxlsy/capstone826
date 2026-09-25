import { describe, it, expect, vi } from "vitest"
import { confirmSuperseded } from "@/lib/auth/confirm-kick"

const mismatch = { valid: false, reason: "mismatch" }
const wait = () => vi.fn().mockResolvedValue(undefined)

// Defect: signing in again in a second tab of the same browser logged out BOTH
// tabs. The other tab heard the realtime push before the new cookies landed,
// saw a mismatch with its old cookies, and its kick made the proxy delete the
// shared cookies the new login had just received.
describe("confirmSuperseded", () => {
  it("does nothing (and never re-checks) when the first check isn't a mismatch", async () => {
    for (const first of [{ valid: true }, { valid: false, reason: "archived" }, { valid: false, reason: "no_session" }, null, undefined]) {
      const recheck = vi.fn()
      expect(await confirmSuperseded(first, recheck, wait(), 2000)).toBe(false)
      expect(recheck).not.toHaveBeenCalled()
    }
  })

  it("does NOT kick when the re-check is valid — the same-browser case, new cookies have landed", async () => {
    const recheck = vi.fn().mockResolvedValue({ valid: true })
    expect(await confirmSuperseded(mismatch, recheck, wait(), 2000)).toBe(false)
  })

  it("kicks when it is still a mismatch after the wait — a genuinely different browser or device", async () => {
    const recheck = vi.fn().mockResolvedValue(mismatch)
    expect(await confirmSuperseded(mismatch, recheck, wait(), 2000)).toBe(true)
  })

  it("does not kick when the re-check fails or returns nothing", async () => {
    expect(await confirmSuperseded(mismatch, vi.fn().mockRejectedValue(new Error("network")), wait(), 2000)).toBe(false)
    expect(await confirmSuperseded(mismatch, vi.fn().mockResolvedValue(null), wait(), 2000)).toBe(false)
  })

  it("waits the requested delay BEFORE re-checking", async () => {
    const order: string[] = []
    const w = vi.fn(async (ms: number) => { order.push(`wait:${ms}`) })
    const recheck = vi.fn(async () => { order.push("recheck"); return mismatch })

    await confirmSuperseded(mismatch, recheck, w, 2000)
    expect(order).toEqual(["wait:2000", "recheck"])
  })
})
