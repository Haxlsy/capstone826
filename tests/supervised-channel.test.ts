import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  startSupervisedChannel,
  createRealtimeHealth,
  GRACE_MS,
  FIRST_RECONCILE_MS,
  HIDDEN_RECONCILE_MS,
  BACKOFF_MAX_MS,
  type RealtimeEnv,
  type WakeReason,
} from "@/lib/realtime/supervised-channel"

function makeEnv() {
  const channels: { topic: string; status: (s: string) => void; change: () => void; closed: boolean }[] = []
  let wake: ((r: WakeReason, hiddenFor: number) => void) | null = null
  let failClose = false
  const env: RealtimeEnv = {
    open(topic, _b, onChange, onStatus) {
      const ch = { topic, status: (s: string) => onStatus(s), change: onChange, closed: false }
      channels.push(ch)
      return () => {
        ch.closed = true
        if (failClose) throw new Error("teardown timed out")
      }
    },
    onWake(cb) {
      wake = cb
      return () => {
        wake = null
      }
    },
    log: () => {},
  }
  return {
    env,
    channels,
    last: () => channels[channels.length - 1],
    wake: (r: WakeReason, h = 0) => wake?.(r, h),
    hasWake: () => wake !== null,
    setFailClose: (v: boolean) => {
      failClose = v
    },
  }
}

function start(catchUp: boolean) {
  const t = makeEnv()
  const onReconcile = vi.fn()
  const onChange = vi.fn()
  const health = createRealtimeHealth()
  const stop = startSupervisedChannel(
    t.env,
    { name: "x", bindings: [{ event: "*", table: "inquiry" }], onChange, onReconcile, catchUp },
    health,
  )
  return { t, onReconcile, onChange, health, stop }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("supervised channel", () => {
  it("reconciles once shortly after the first SUBSCRIBED, only for catchUp consumers", () => {
    const a = start(true)
    a.t.last().status("SUBSCRIBED")
    expect(a.onReconcile).not.toHaveBeenCalled()
    vi.advanceTimersByTime(FIRST_RECONCILE_MS)
    expect(a.onReconcile).toHaveBeenCalledTimes(1)
    expect(a.onReconcile).toHaveBeenCalledWith("first")

    const b = start(false)
    b.t.last().status("SUBSCRIBED")
    vi.advanceTimersByTime(FIRST_RECONCILE_MS * 3)
    expect(b.onReconcile).not.toHaveBeenCalled()
  })

  it("forwards change events from the current channel only", () => {
    const { t, onChange } = start(false)
    t.last().status("SUBSCRIBED")
    t.last().change()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("replaces a channel that stays down with a NEW topic, backing off, and resets on success", () => {
    const { t } = start(false)
    const first = t.last()
    first.status("CHANNEL_ERROR")
    vi.advanceTimersByTime(GRACE_MS) // grace over -> replace scheduled (1s)
    expect(first.closed).toBe(true)
    expect(t.channels).toHaveLength(1)
    vi.advanceTimersByTime(1_000)
    expect(t.channels).toHaveLength(2)
    expect(t.last().topic).not.toBe(first.topic)

    // second failure -> 2s backoff
    t.last().status("TIMED_OUT")
    vi.advanceTimersByTime(GRACE_MS + 1_999)
    expect(t.channels).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(t.channels).toHaveLength(3)

    // success resets backoff to 1s
    t.last().status("SUBSCRIBED")
    t.last().status("CLOSED")
    vi.advanceTimersByTime(GRACE_MS + 1_000)
    expect(t.channels).toHaveLength(4)
  })

  it("caps the backoff", () => {
    const { t } = start(false)
    for (let i = 0; i < 12; i++) {
      t.last().status("CHANNEL_ERROR")
      vi.advanceTimersByTime(GRACE_MS + BACKOFF_MAX_MS)
    }
    const before = t.channels.length
    t.last().status("CHANNEL_ERROR")
    vi.advanceTimersByTime(GRACE_MS + BACKOFF_MAX_MS)
    expect(t.channels.length).toBe(before + 1)
  })

  it("lets the library recover on its own inside the grace period, then reconciles once for everyone", () => {
    const { t, onReconcile } = start(false)
    t.last().status("SUBSCRIBED")
    t.last().status("CHANNEL_ERROR")
    vi.advanceTimersByTime(GRACE_MS - 1)
    t.last().status("SUBSCRIBED")
    vi.advanceTimersByTime(GRACE_MS * 3)
    expect(t.channels).toHaveLength(1)
    expect(onReconcile).toHaveBeenCalledTimes(1)
    expect(onReconcile).toHaveBeenCalledWith("resubscribed")
  })

  it("reconciles after long-hidden / online only for catchUp consumers", () => {
    const a = start(true)
    a.t.last().status("SUBSCRIBED")
    vi.advanceTimersByTime(FIRST_RECONCILE_MS)
    a.onReconcile.mockClear()
    a.t.wake("visible", HIDDEN_RECONCILE_MS - 1)
    expect(a.onReconcile).not.toHaveBeenCalled()
    a.t.wake("visible", HIDDEN_RECONCILE_MS)
    expect(a.onReconcile).toHaveBeenCalledWith("visible")
    a.t.wake("online")
    expect(a.onReconcile).toHaveBeenCalledWith("online")

    const b = start(false)
    b.t.last().status("SUBSCRIBED")
    b.t.wake("visible", HIDDEN_RECONCILE_MS * 10)
    b.t.wake("online")
    expect(b.onReconcile).not.toHaveBeenCalled()
  })

  it("wake while down recreates immediately instead of waiting out grace/backoff", () => {
    const { t } = start(false)
    t.last().status("CHANNEL_ERROR")
    t.wake("online")
    vi.advanceTimersByTime(0)
    expect(t.channels).toHaveLength(2)
  })

  it("teardown stops timers and never recreates", () => {
    const { t, stop, health } = start(true)
    t.last().status("CHANNEL_ERROR")
    stop()
    vi.advanceTimersByTime(GRACE_MS + BACKOFF_MAX_MS * 2)
    expect(t.channels).toHaveLength(1)
    expect(t.last().closed).toBe(true)
    expect(t.hasWake()).toBe(false)
    expect(health.getGroupStatus("x")).toBe("connecting")
  })

  it("a failing teardown of the old channel can't be reused (fresh topic each time)", () => {
    const { t } = start(false)
    t.setFailClose(true)
    const first = t.last()
    first.status("CHANNEL_ERROR")
    vi.advanceTimersByTime(GRACE_MS + 1_000)
    expect(t.channels).toHaveLength(2)
    expect(t.last().topic).not.toBe(first.topic)
  })

  it("ignores stale events from a replaced channel", () => {
    const { t, onChange, onReconcile } = start(false)
    const old = t.last()
    old.status("CHANNEL_ERROR")
    vi.advanceTimersByTime(GRACE_MS + 1_000)
    old.change()
    old.status("SUBSCRIBED")
    expect(onChange).not.toHaveBeenCalled()
    expect(onReconcile).not.toHaveBeenCalled()
  })

  it("health reflects live / reconnecting", () => {
    const { t, health } = start(false)
    expect(health.getGroupStatus("x")).toBe("connecting")
    t.last().status("SUBSCRIBED")
    expect(health.getGroupStatus("x")).toBe("live")
    t.last().status("CHANNEL_ERROR")
    expect(health.getGroupStatus("x")).toBe("reconnecting")
  })
})
