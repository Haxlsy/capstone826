/**
 * Guards against a stale async response clobbering fresher state — the exact
 * race behind the notification bell's count "flickering" (4 -> 5 -> 4): an
 * optimistic update (marking one read) landed, but a refetch that was
 * already in flight *before* that update resolved afterward with the older,
 * pre-mutation count and overwrote it.
 *
 * Every fetch is stamped with a token from `next()`; its response is only
 * applied if `isCurrent(token)` is still true when it resolves — i.e.
 * nothing newer (another fetch, or an optimistic mutation via `invalidate()`)
 * has started since. Pure, no I/O — the same dependency-injected-free style
 * as this app's other small stores (lib/reachability-store.ts,
 * lib/realtime/supervised-channel.ts), just with nothing to inject here.
 */
export interface SequenceGuard {
  /** Call at the start of an async operation; returns a token to check later. */
  next(): number
  /** Whether `token` is still the most recent thing started — nothing newer
   *  (another fetch, or an `invalidate()`) has happened since. */
  isCurrent(token: number): boolean
  /** Invalidates any in-flight operation without starting a new one — call
   *  this the moment local state changes by some other means (e.g. an
   *  optimistic update), so a response from before that change can never
   *  overwrite it once it resolves. */
  invalidate(): void
}

export function createSequenceGuard(): SequenceGuard {
  let seq = 0
  return {
    next: () => ++seq,
    isCurrent: (token) => token === seq,
    invalidate: () => {
      seq++
    },
  }
}

/**
 * Tracks a page's "loading" flag across overlapping reloads, some of which
 * show the loading state (a visible reload) and some of which do not (a
 * silent, in-place refresh from a realtime event or regaining focus).
 *
 * The rule: whichever reload is the LATEST to have started turns loading off
 * when it finishes, whether it was visible or silent. A superseded reload
 * leaves the flag alone, since the newer one will clear it.
 *
 * Without this, a visible reload that was superseded by a silent one stopped
 * early without clearing the flag, and the silent one never touched it, so
 * the page sat on its loading skeleton until it was reopened. On the Head
 * Technician job page that happened after most actions, because the action's
 * own database change triggered the silent reload.
 */
export interface LoadTracker {
  /** Start a reload. A visible one turns loading on. Returns its token. */
  begin(opts?: { silent?: boolean }): number
  /** Whether this reload is still the latest, i.e. its result should be applied. */
  isCurrent(token: number): boolean
  /** Finish a reload. The latest one turns loading off. */
  end(token: number): void
}

export function createLoadTracker(setLoading: (loading: boolean) => void): LoadTracker {
  const guard = createSequenceGuard()
  return {
    begin: (opts) => {
      if (!opts?.silent) setLoading(true)
      return guard.next()
    },
    isCurrent: (token) => guard.isCurrent(token),
    end: (token) => {
      if (guard.isCurrent(token)) setLoading(false)
    },
  }
}
