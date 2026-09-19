import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createReachabilityStore, type ReachabilityEnv } from "@/lib/reachability-store"

const INTERVAL = 20_000

function setup(over: Partial<ReachabilityEnv> = {}) {
  const state = { online: true, visible: true, result: true }
  const wakeCallbacks = new Set<() => void>()
  const ping = vi.fn(async () => state.result)
  const store = createReachabilityStore({
    ping,
    isOnline: () => state.online,
    isVisible: () => state.visible,
    onWake: (cb) => {
      wakeCallbacks.add(cb)
      return () => wakeCallbacks.delete(cb)
    },
    intervalMs: INTERVAL,
    ...over,
  })
  const wake = () => wakeCallbacks.forEach((cb) => cb())
  return { store, state, ping, wake, wakeCallbacks }
}

// Lets the awaited ping inside beat() settle.
const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("createReachabilityStore", () => {
  it("many subscribers share ONE ping at start and ONE per interval (the reported bug)", async () => {
    const { store, ping } = setup()
    const unsubs = Array.from({ length: 6 }, () => store.subscribe(() => {}))
    await flush()
    expect(ping).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(ping).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(ping).toHaveBeenCalledTimes(3)
    unsubs.forEach((u) => u())
  })

  it("stops the timer when the last subscriber leaves, and restarts on a new one", async () => {
    const { store, ping } = setup()
    const a = store.subscribe(() => {})
    const b = store.subscribe(() => {})
    await flush()
    a()
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(ping).toHaveBeenCalledTimes(2) // still running for b
    b()
    await vi.advanceTimersByTimeAsync(INTERVAL * 3)
    expect(ping).toHaveBeenCalledTimes(2) // stopped

    const c = store.subscribe(() => {})
    await flush()
    expect(ping).toHaveBeenCalledTimes(3) // fresh start pings immediately
    c()
  })

  it("does not ping while the browser is offline, and re-checks immediately on wake", async () => {
    const { store, state, ping, wake } = setup()
    state.online = false
    const u = store.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(ping).not.toHaveBeenCalled()

    state.online = true
    wake()
    await flush()
    expect(ping).toHaveBeenCalledTimes(1)
    u()
  })

  it("does not ping in a hidden tab, and pings once when it becomes visible", async () => {
    const { store, state, ping, wake } = setup()
    state.visible = false
    const u = store.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(ping).not.toHaveBeenCalled()

    state.visible = true
    wake()
    await flush()
    expect(ping).toHaveBeenCalledTimes(1)
    u()
  })

  it("never runs a second ping while one is still in flight", async () => {
    let release!: (ok: boolean) => void
    const ping = vi.fn(() => new Promise<boolean>((r) => { release = r }))
    const { store, wake } = setup({ ping })
    const u = store.subscribe(() => {})
    await flush()
    wake()
    wake()
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(ping).toHaveBeenCalledTimes(1)
    release(true)
    u()
  })

  it("notifies subscribers only when the result changes", async () => {
    const { store, state } = setup()
    const cb = vi.fn()
    const u = store.subscribe(cb)
    await flush()
    expect(cb).not.toHaveBeenCalled() // true -> true

    state.result = false
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(cb).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot()).toBe(false)

    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(cb).toHaveBeenCalledTimes(1) // false -> false
    u()
  })

  it("treats a throwing ping as unreachable rather than crashing the timer", async () => {
    const { store } = setup({ ping: vi.fn(async () => { throw new Error("boom") }) })
    const u = store.subscribe(() => {})
    await flush()
    expect(store.getSnapshot()).toBe(false)
    u()
  })

  it("ignores a ping that resolves after the last subscriber already left", async () => {
    let release!: (ok: boolean) => void
    const ping = vi.fn(() => new Promise<boolean>((r) => { release = r }))
    const { store } = setup({ ping })
    const u = store.subscribe(() => {})
    await flush()
    u()
    release(false)
    await flush()
    expect(store.getSnapshot()).toBe(true) // stale result discarded
  })
})
