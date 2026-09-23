import { describe, it, expect } from "vitest"
import { createSequenceGuard } from "@/lib/fetch-sequence"

describe("createSequenceGuard", () => {
  it("a token is current until something newer starts", () => {
    const guard = createSequenceGuard()
    const a = guard.next()
    expect(guard.isCurrent(a)).toBe(true)
  })

  it("an earlier token stops being current once a newer fetch starts", () => {
    const guard = createSequenceGuard()
    const a = guard.next()
    const b = guard.next()
    expect(guard.isCurrent(a)).toBe(false)
    expect(guard.isCurrent(b)).toBe(true)
  })

  it("reproduces the bell's fix: an optimistic mutation invalidates an already-in-flight fetch", () => {
    const guard = createSequenceGuard()
    // A realtime-triggered refetch starts (unrelated to the click about to happen)...
    const staleFetch = guard.next()
    // ...then the user clicks a notification: the optimistic update fires
    // and invalidates anything already in flight, without itself being a
    // new "fetch" (nothing to apply when it "resolves" — there's no request).
    guard.invalidate()
    // The earlier fetch's response arrives late — it must be discarded, not
    // allowed to clobber the optimistic count.
    expect(guard.isCurrent(staleFetch)).toBe(false)
  })

  it("a fetch started after invalidate() is unaffected", () => {
    const guard = createSequenceGuard()
    guard.invalidate()
    const fresh = guard.next()
    expect(guard.isCurrent(fresh)).toBe(true)
  })

  it("out-of-order resolution: only the latest-started token wins", () => {
    const guard = createSequenceGuard()
    const first = guard.next()
    const second = guard.next()
    const third = guard.next()
    // Simulate `second` resolving before `first` (network reordering) —
    // neither is current once `third` has started.
    expect(guard.isCurrent(second)).toBe(false)
    expect(guard.isCurrent(first)).toBe(false)
    expect(guard.isCurrent(third)).toBe(true)
  })
})
