/**
 * Is this browser already signed in? Used by the login page, which can be
 * open in a tab that was loaded while logged out and is still on screen after
 * another tab of the same browser signed in. Two tabs share one cookie jar, so
 * a second sign-in from that stale form rotates the session token and revokes
 * sessions — the start of a race that can log out both tabs. proxy.ts only
 * bounces a signed-in visitor who *navigates* to /login; it never sees an
 * already-loaded form.
 *
 * Fails OPEN by design: a non-OK response, a network error or a timeout all
 * mean "not known to be signed in", so a slow or broken check can delay the
 * login form but never lock anyone out of it.
 *
 * `fetchImpl` is injected so this is unit-tested without a network.
 */
export function isAlreadySignedIn(status: unknown): boolean {
  return typeof status === "object" && status !== null && (status as { valid?: unknown }).valid === true
}

export async function checkAlreadySignedIn(fetchImpl: typeof fetch, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl("/api/auth/session-status", { cache: "no-store", signal: controller.signal })
    if (!res.ok) return false
    return isAlreadySignedIn(await res.json())
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
