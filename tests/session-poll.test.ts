import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { startSessionPoll } from "@/lib/auth/session-poll"

// Node's timers don't enforce the receiver-binding rule browsers do, so this
// can't catch a bare `{ setInterval }` being passed in (see the comment in
// lib/auth/session-poll.ts) — it covers the scheduling rules only.
let visible = true
let listeners: Array<() => void> = []
const setVisible = (v: boolean) => {
  visible = v
  listeners.forEach((l) => l())
}

const makeEnv = () => ({
  setInterval,
  clearInterval,
  isVisible: () => visible,
  onVisibilityChange: (cb: () => void) => {
    listeners.push(cb)
    return () => {
      listeners = listeners.filter((l) => l !== cb)
    }
  },
})

beforeEach(() => {
  vi.useFakeTimers()
  visible = true
  listeners = []
})
afterEach(() => vi.useRealTimers())

describe("startSessionPoll", () => {
  it("checks every interval while the tab is visible, but not immediately on start", () => {
    const onCheck = vi.fn()
    startSessionPoll(makeEnv(), { intervalMs: 60_000, onCheck })

    expect(onCheck).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(onCheck).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(120_000)
    expect(onCheck).toHaveBeenCalledTimes(3)
  })

  it("does not poll while the tab is hidden", () => {
    visible = false
    const onCheck = vi.fn()
    startSessionPoll(makeEnv(), { intervalMs: 60_000, onCheck })

    vi.advanceTimersByTime(10 * 60_000)
    expect(onCheck).not.toHaveBeenCalled()
  })

  it("checks immediately when the tab becomes visible, then resumes polling", () => {
    visible = false
    const onCheck = vi.fn()
    startSessionPoll(makeEnv(), { intervalMs: 60_000, onCheck })

    setVisible(true)
    expect(onCheck).toHaveBeenCalledTimes(1) // no waiting out the interval
    vi.advanceTimersByTime(60_000)
    expect(onCheck).toHaveBeenCalledTimes(2)
  })

  it("stops polling when the tab is hidden again", () => {
    const onCheck = vi.fn()
    startSessionPoll(makeEnv(), { intervalMs: 60_000, onCheck })

    setVisible(false)
    vi.advanceTimersByTime(5 * 60_000)
    expect(onCheck).not.toHaveBeenCalled()
  })

  it("does nothing after it is stopped", () => {
    const onCheck = vi.fn()
    const stop = startSessionPoll(makeEnv(), { intervalMs: 60_000, onCheck })

    stop()
    vi.advanceTimersByTime(5 * 60_000)
    setVisible(false)
    setVisible(true)
    expect(onCheck).not.toHaveBeenCalled()
  })
})
