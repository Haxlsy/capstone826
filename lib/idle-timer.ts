/**
 * Pure, injectable idle-warn/idle-timeout scheduler — the same
 * dependency-injected pattern as lib/reachability-store.ts and
 * lib/realtime/supervised-channel.ts, so the timing rules are unit-testable
 * with fake timers instead of a real DOM/browser.
 */

export interface IdleTimerEnv {
  setTimeout: typeof setTimeout
  clearTimeout: typeof clearTimeout
}

export interface IdleTimerOptions {
  /** Total time from the last reset until onTimeout fires. */
  idleMs: number
  /** How long before idleMs onWarn fires — e.g. idleMs=20min, warningMs=60s
   *  means onWarn fires at 19 minutes, onTimeout at 20. */
  warningMs: number
  onWarn(): void
  onTimeout(): void
}

export interface IdleTimer {
  /** Cancels and reschedules both onWarn and onTimeout from now. Call on
   *  genuine activity, or explicitly (e.g. "Stay signed in"). */
  reset(): void
  /** Cancels both timers permanently — nothing fires again after this. */
  stop(): void
}

export function startIdleTimer(env: IdleTimerEnv, opts: IdleTimerOptions): IdleTimer {
  let warnHandle: ReturnType<typeof setTimeout> | null = null
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  function clear() {
    if (warnHandle) env.clearTimeout(warnHandle)
    if (timeoutHandle) env.clearTimeout(timeoutHandle)
    warnHandle = null
    timeoutHandle = null
  }

  function schedule() {
    if (stopped) return
    clear()
    const warnDelay = Math.max(0, opts.idleMs - opts.warningMs)
    warnHandle = env.setTimeout(() => {
      warnHandle = null
      if (!stopped) opts.onWarn()
    }, warnDelay)
    timeoutHandle = env.setTimeout(() => {
      timeoutHandle = null
      if (!stopped) opts.onTimeout()
    }, opts.idleMs)
  }

  schedule()

  return {
    reset: schedule,
    stop() {
      stopped = true
      clear()
    },
  }
}
