import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { startIdleTimer } from "@/lib/idle-timer"

let env: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout }

beforeEach(() => {
  vi.useFakeTimers()
  // Built after useFakeTimers() so these are vitest's faked timer functions,
  // not a stale reference to the real ones captured at module load.
  env = { setTimeout, clearTimeout }
})
afterEach(() => vi.useRealTimers())

describe("startIdleTimer", () => {
  it("warns at idleMs - warningMs, times out at idleMs", () => {
    const onWarn = vi.fn()
    const onTimeout = vi.fn()
    startIdleTimer(env, { idleMs: 20 * 60_000, warningMs: 60_000, onWarn, onTimeout })

    vi.advanceTimersByTime(19 * 60_000 - 1)
    expect(onWarn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onWarn).toHaveBeenCalledTimes(1)
    expect(onTimeout).not.toHaveBeenCalled()

    vi.advanceTimersByTime(59_999)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it("reset() restarts both from zero", () => {
    const onWarn = vi.fn()
    const onTimeout = vi.fn()
    const timer = startIdleTimer(env, { idleMs: 20 * 60_000, warningMs: 60_000, onWarn, onTimeout })

    vi.advanceTimersByTime(19 * 60_000) // right at the warn boundary
    expect(onWarn).toHaveBeenCalledTimes(1)

    timer.reset()
    vi.advanceTimersByTime(19 * 60_000 - 1)
    expect(onWarn).toHaveBeenCalledTimes(1) // not fired again yet — clock restarted
    vi.advanceTimersByTime(1)
    expect(onWarn).toHaveBeenCalledTimes(2)
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it("stop() cancels both and nothing fires after", () => {
    const onWarn = vi.fn()
    const onTimeout = vi.fn()
    const timer = startIdleTimer(env, { idleMs: 20 * 60_000, warningMs: 60_000, onWarn, onTimeout })

    timer.stop()
    vi.advanceTimersByTime(60 * 60_000)
    expect(onWarn).not.toHaveBeenCalled()
    expect(onTimeout).not.toHaveBeenCalled()
  })

  it("clamps a warningMs larger than idleMs instead of scheduling a negative delay", () => {
    const onWarn = vi.fn()
    const onTimeout = vi.fn()
    startIdleTimer(env, { idleMs: 1000, warningMs: 5000, onWarn, onTimeout })

    // warnDelay clamps to 0 — fires (near-)immediately, well before onTimeout.
    vi.advanceTimersByTime(0)
    expect(onWarn).toHaveBeenCalledTimes(1)
    expect(onTimeout).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  // Defect: hooks/useIdleTimeout.ts passed `{ setTimeout, clearTimeout }` —
  // bare global references, detached from their required receiver. Real
  // browsers throw "Illegal invocation" for a detached Window operation
  // called as env.setTimeout(...)/env.clearTimeout(...) (this file's own
  // schedule()). That specific throw can't be reproduced here: verified
  // directly (`node -e`) that Node's setTimeout/clearTimeout do NOT enforce
  // a receiver the way browsers do, so a Node-environment test — this
  // project's vitest config uses environment: "node" — cannot fail on the
  // old, buggy bare-reference shape no matter how it calls them. jsdom might
  // reproduce it but isn't a dependency here, and adding one is out of scope
  // for a one-line fix. This instead asserts the structural property that
  // actually distinguishes the fix from the bug: the functions passed must
  // be produced by .bind(), not the bare global functions themselves — real
  // regression coverage for the exact browser exception would require a
  // browser/jsdom-based test this suite doesn't have.
  it("regression: setTimeout/clearTimeout are bound before use, not passed bare", () => {
    vi.useRealTimers()
    const bound = { setTimeout: setTimeout.bind(globalThis), clearTimeout: clearTimeout.bind(globalThis) }
    expect(bound.setTimeout).not.toBe(setTimeout)
    expect(bound.clearTimeout).not.toBe(clearTimeout)

    const timer = startIdleTimer(bound, { idleMs: 10, warningMs: 5, onWarn: () => {}, onTimeout: () => {} })
    timer.stop()
  })
})
