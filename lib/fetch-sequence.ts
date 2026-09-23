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
