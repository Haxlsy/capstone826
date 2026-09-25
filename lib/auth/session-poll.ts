/**
 * Fallback for the single-active-session check. An idle tab that never
 * navigates learns it was superseded from a Realtime push on
 * user_active_session (hooks/useSessionEnforcement.ts) — but that depends on
 * one WebSocket staying up, and its own catch-up only re-checks on refocus
 * after a 30s+ absence. If the socket is down, a stale tab would sit logged
 * in indefinitely. This re-runs the check whenever the tab becomes visible and
 * on an interval while it is visible, so a dropped socket can't hide a kick.
 *
 * Dependency-injected (no window/document here) so the timing rules are unit
 * tested with fake timers — same approach as lib/idle-timer.ts. Callers must
 * pass the timer functions BOUND (`setInterval.bind(globalThis)`): handing a
 * bare `{ setInterval }` makes `env.setInterval(...)` throw "Illegal
 * invocation" in a real browser (see hooks/useIdleTimeout.ts).
 */
export interface SessionPollEnv {
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
  isVisible(): boolean
  /** Subscribe to visibility changes; returns the unsubscribe function. */
  onVisibilityChange(cb: () => void): () => void
}

export interface SessionPollOptions {
  intervalMs: number
  onCheck(): void
}

/** Starts polling; returns a function that stops it and unsubscribes. */
export function startSessionPoll(env: SessionPollEnv, opts: SessionPollOptions): () => void {
  let handle: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (handle === null) handle = env.setInterval(() => opts.onCheck(), opts.intervalMs)
  }
  const stop = () => {
    if (handle !== null) {
      env.clearInterval(handle)
      handle = null
    }
  }

  const unsubscribe = env.onVisibilityChange(() => {
    if (env.isVisible()) {
      // Coming back to the tab: don't wait out the interval — this is the
      // moment a user is most likely to act on a session that's already dead.
      opts.onCheck()
      start()
    } else {
      stop()
    }
  })

  // No immediate check on start: the hook already runs one on mount.
  if (env.isVisible()) start()

  return () => {
    stop()
    unsubscribe()
  }
}
