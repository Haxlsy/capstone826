/**
 * Decides whether a session-status "mismatch" is real before a tab acts on it.
 *
 * Two tabs of one browser share one cookie jar. When one signs in again, the
 * server writes the new session token *before* that response (carrying the new
 * cookies) reaches the browser — so the other tab, hearing the realtime push in
 * that gap, checks with its still-old cookies and sees a mismatch. Acting on
 * that navigates it to /login with stale cookies, and proxy.ts answers a stale
 * request by deleting cookies — which, in a shared jar, deletes the ones the
 * new login just received, logging out BOTH tabs.
 *
 * So a mismatch is only acted on if it is still a mismatch after a short wait.
 * In a shared jar the new cookies have landed by then and the re-check is
 * valid; a genuinely different browser/device is still stale and still gets
 * kicked, just a moment later. Anything ambiguous (the re-check failing) means
 * don't kick — same rule the hook already follows for network blips.
 *
 * Pure and dependency-injected: no fetch, no timers, so it is unit tested.
 */
export interface SessionStatus {
  valid?: boolean
  reason?: string
}

const isMismatch = (s: SessionStatus | null | undefined): boolean =>
  s?.valid === false && s.reason === "mismatch"

export async function confirmSuperseded(
  first: SessionStatus | null | undefined,
  recheck: () => Promise<SessionStatus | null | undefined>,
  wait: (ms: number) => Promise<void>,
  delayMs: number,
): Promise<boolean> {
  if (!isMismatch(first)) return false
  try {
    await wait(delayMs)
    return isMismatch(await recheck())
  } catch {
    return false
  }
}
