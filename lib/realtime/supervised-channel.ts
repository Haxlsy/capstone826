/**
 * One logical Realtime subscription that outlives any single channel.
 *
 * Supabase `postgres_changes` is at-most-once: anything that happens while a
 * channel is disconnected, still joining, or being replaced is never replayed.
 * The app used to open a channel and forget it, so every gap (a phone locking,
 * a backgrounded tab, a dropped socket, the second or two before the server
 * listener is live) left a screen silently stale until reload. This wraps a
 * channel with three things:
 *
 *  - supervision: statuses are observed and logged, and a channel that stays
 *    down is torn down and replaced (fresh topic, exponential backoff);
 *  - catch-up: `onReconcile` fires whenever events may have been missed, so the
 *    consumer refetches instead of trusting the stream;
 *  - health: a small store the UI can show ("Live" / "Reconnecting…").
 *
 * Dependency-injected (no window/supabase here) so the timing rules can be unit
 * tested with fake timers — same approach as lib/reachability-store.ts.
 */

export interface Binding {
  event: "*" | "INSERT"
  table: string
  filter?: string
}

export type ReconcileReason = "first" | "resubscribed" | "visible" | "online"
export type WakeReason = "visible" | "online"
export type HealthStatus = "connecting" | "live" | "reconnecting"

export interface RealtimeEnv {
  /** Create + subscribe a channel; returns a function that tears it down. */
  open(
    topic: string,
    bindings: Binding[],
    onChange: () => void,
    onStatus: (status: string, err?: unknown) => void,
  ): () => void
  /** "Worth re-checking now": tab back in the foreground (with how long it was hidden) / browser back online. */
  onWake(cb: (reason: WakeReason, hiddenForMs: number) => void): () => void
  log(message: string, err?: unknown): void
}

export interface SupervisedOptions {
  /** Diagnostics + topic prefix. */
  name: string
  /** Health-store grouping; defaults to `name`. */
  group?: string
  bindings: Binding[]
  onChange: () => void
  /** Called when events may have been missed — refetch. */
  onReconcile?: (reason: ReconcileReason) => void
  /**
   * Critical screens: also reconcile once shortly after the first connect
   * (closes the gap where the client reports "ready" before the server-side
   * listener is), and after the tab returns from a long background / the
   * browser comes back online.
   */
  catchUp?: boolean
}

// How long to let the library's own rejoin logic work before replacing the channel.
export const GRACE_MS = 8_000
export const BACKOFF_BASE_MS = 1_000
export const BACKOFF_MAX_MS = 30_000
export const FIRST_RECONCILE_MS = 2_000
export const HIDDEN_RECONCILE_MS = 30_000

// ── Health ───────────────────────────────────────────────────────────────────

type SubState = "connecting" | "live" | "down"

export function createRealtimeHealth() {
  const subs = new Map<symbol, { group: string; state: SubState }>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  return {
    register(group: string) {
      const id = Symbol(group)
      subs.set(id, { group, state: "connecting" })
      emit()
      return {
        set(state: SubState) {
          const s = subs.get(id)
          if (!s || s.state === state) return
          s.state = state
          emit()
        },
        remove() {
          if (subs.delete(id)) emit()
        },
      }
    },
    getGroupStatus(group: string): HealthStatus {
      let any = false
      let connecting = false
      for (const s of subs.values()) {
        if (s.group !== group) continue
        any = true
        if (s.state === "down") return "reconnecting"
        if (s.state === "connecting") connecting = true
      }
      return !any || connecting ? "connecting" : "live"
    },
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}

export const realtimeHealth = createRealtimeHealth()

// ── Supervision ──────────────────────────────────────────────────────────────

let topicSeq = 0

export function startSupervisedChannel(
  env: RealtimeEnv,
  opts: SupervisedOptions,
  health = realtimeHealth,
): () => void {
  const reg = health.register(opts.group ?? opts.name)
  let stopped = false
  let gen = 0
  let closeCurrent: (() => void) | null = null
  let state: SubState = "connecting"
  let everLive = false
  let wasDown = false
  let attempt = 0
  let graceTimer: ReturnType<typeof setTimeout> | null = null
  let recreateTimer: ReturnType<typeof setTimeout> | null = null
  let firstTimer: ReturnType<typeof setTimeout> | null = null

  const setState = (s: SubState) => {
    state = s
    reg.set(s)
  }

  function reconcile(reason: ReconcileReason) {
    try {
      opts.onReconcile?.(reason)
    } catch (err) {
      env.log(`${opts.name} reconcile failed`, err)
    }
  }

  function open() {
    if (stopped) return
    const myGen = ++gen
    // Unique per channel instance: `client.channel(name)` hands back an
    // already-registered channel with the same name, and one whose teardown
    // timed out stays registered — so a reused name can resurrect a dead one.
    const topic = `${opts.name}:${++topicSeq}`
    closeCurrent = env.open(
      topic,
      opts.bindings,
      () => {
        if (!stopped && myGen === gen) opts.onChange()
      },
      (status, err) => onStatus(myGen, status, err),
    )
  }

  function closeChannel() {
    gen++ // anything the old channel still emits is now ignored
    const close = closeCurrent
    closeCurrent = null
    try {
      close?.()
    } catch (err) {
      env.log(`${opts.name} teardown failed`, err)
    }
  }

  function recreate(immediate: boolean) {
    if (stopped) return
    closeChannel()
    if (recreateTimer) clearTimeout(recreateTimer)
    const delay = immediate ? 0 : Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS)
    attempt++
    setState("down")
    env.log(`${opts.name} replacing channel in ${delay}ms (attempt ${attempt})`)
    recreateTimer = setTimeout(() => {
      recreateTimer = null
      open()
    }, delay)
  }

  function onStatus(myGen: number, status: string, err?: unknown) {
    if (stopped || myGen !== gen) return

    if (status === "SUBSCRIBED") {
      if (graceTimer) clearTimeout(graceTimer)
      graceTimer = null
      attempt = 0
      setState("live")
      const recovered = wasDown
      wasDown = false
      if (recovered) {
        everLive = true
        reconcile("resubscribed")
      } else if (!everLive) {
        everLive = true
        if (opts.catchUp) {
          firstTimer = setTimeout(() => {
            firstTimer = null
            if (!stopped) reconcile("first")
          }, FIRST_RECONCILE_MS)
        }
      }
      return
    }

    // CHANNEL_ERROR | TIMED_OUT | CLOSED
    env.log(`${opts.name} ${status}`, err)
    wasDown = true
    setState("down")
    if (!graceTimer) {
      graceTimer = setTimeout(() => {
        graceTimer = null
        recreate(false)
      }, GRACE_MS)
    }
  }

  const unwake = env.onWake((reason, hiddenForMs) => {
    if (stopped) return
    if (state === "down") {
      // Something is already wrong and the user is looking again / has network
      // again — don't wait out the grace period or the backoff.
      if (graceTimer) clearTimeout(graceTimer)
      graceTimer = null
      attempt = 0
      recreate(true)
    } else if (state === "live" && opts.catchUp && (reason === "online" || hiddenForMs >= HIDDEN_RECONCILE_MS)) {
      reconcile(reason)
    }
  })

  open()

  return () => {
    stopped = true
    if (graceTimer) clearTimeout(graceTimer)
    if (recreateTimer) clearTimeout(recreateTimer)
    if (firstTimer) clearTimeout(firstTimer)
    unwake()
    closeChannel()
    reg.remove()
  }
}
