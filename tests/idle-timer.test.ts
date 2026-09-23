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
})
