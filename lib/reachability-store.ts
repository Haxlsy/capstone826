/**
 * One shared "can we actually reach the server" heartbeat.
 *
 * useOnlineStatus() is called from ~10 places that mount together on a page.
 * When each of those owned its own timer, one tab fired the same /api/health
 * check 5–7 times in the same millisecond every interval (the timers were all
 * started in the same tick, so they stayed phase-locked). This holds the
 * check in one place: the first subscriber starts a single timer, the last
 * one stops it, and every subscriber just reads the shared result.
 *
 * Pure and dependency-injected (no window/fetch/timers of its own beyond
 * setInterval) so the "exactly one ping no matter how many subscribers"
 * guarantee can be unit tested.
 */

export interface ReachabilityEnv {
  /** Resolves true if the server answered, false if it didn't. Must not throw. */
  ping: () => Promise<boolean>
  /** The browser's own online flag — no point pinging when it says offline. */
  isOnline: () => boolean
  /** A hidden tab has nobody to show the result to, so it shouldn't ping. */
  isVisible: () => boolean
  /**
   * Subscribe to "worth re-checking right now" moments (the browser came back
   * online, the tab became visible again). Returns an unsubscribe function.
   */
  onWake: (cb: () => void) => () => void
  intervalMs: number
}

export interface ReachabilityStore {
  subscribe: (cb: () => void) => () => void
  getSnapshot: () => boolean
}

export function createReachabilityStore(env: ReachabilityEnv): ReachabilityStore {
  // Optimistic until proven otherwise — matches what every page is server
  // rendered (and service-worker cached) as.
  let reachable = true
  const subscribers = new Set<() => void>()
  let timer: ReturnType<typeof setInterval> | null = null
  let unwake: (() => void) | null = null
  let inFlight = false
  // Bumped on stop() so a ping that was already in flight when the last
  // subscriber left can't write its result into a later run.
  let generation = 0

  async function beat() {
    if (inFlight || !env.isOnline() || !env.isVisible()) return
    inFlight = true
    const gen = generation
    let ok: boolean
    try {
      ok = await env.ping()
    } catch {
      ok = false
    }
    if (gen !== generation) return
    inFlight = false
    if (ok !== reachable) {
      reachable = ok
      subscribers.forEach((cb) => cb())
    }
  }

  function start() {
    void beat()
    timer = setInterval(() => void beat(), env.intervalMs)
    unwake = env.onWake(() => void beat())
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    unwake?.()
    unwake = null
    generation++
    inFlight = false
  }

  return {
    subscribe(cb) {
      subscribers.add(cb)
      if (subscribers.size === 1) start()
      return () => {
        subscribers.delete(cb)
        if (subscribers.size === 0) stop()
      }
    },
    getSnapshot: () => reachable,
  }
}
