"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

/**
 * The single logout routine — previously copy-pasted into every sidebar and
 * the head-technician BottomNav.
 *
 * `hard`/`reason` are for a logout the APP forces (idle-timeout), not one the
 * user clicked: a hard `window.location.href` instead of a soft router push,
 * matching why hooks/useSessionEnforcement.ts already prefers a hard redirect
 * for a forced sign-out (tears down realtime channels/client state cleanly,
 * instead of a soft transition leaving stale connections behind), plus a
 * `?reason=` LoginPage.tsx turns into an explanatory toast. Every existing
 * caller passes nothing and keeps today's exact behavior.
 */
export function useLogout(opts?: { hard?: boolean; reason?: string }) {
  const router = useRouter()
  return useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("826_user")
    } catch {
      /* ignore */
    }
    try {
      // Drop cached pages / list-endpoint responses (customer PII) so they
      // don't linger for the next person on a shared machine. Static build
      // assets are kept. See public/sw.js.
      navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_APP_CACHES" })
    } catch {
      /* ignore */
    }
    if (opts?.hard) {
      window.location.href = `/login${opts.reason ? `?reason=${opts.reason}` : ""}`
      return
    }
    // Straight to /login, not "/" — "/" is just a server redirect() to
    // /login, so pushing there would navigate twice.
    router.push("/login")
  }, [router, opts])
}

/**
 * Logout gated behind a confirmation. The button `onClick`s `requestLogout`;
 * render a <ConfirmModal> wired to `{ confirming, loading, cancel, confirm }`.
 * Not used for the automatic post-password-change sign-out — that stays
 * immediate (see components/shared/ChangePasswordSettings.tsx).
 */
export function useLogoutConfirm() {
  const logout = useLogout()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const requestLogout = useCallback(() => setConfirming(true), [])
  const cancel = useCallback(() => setConfirming(false), [])
  const confirm = useCallback(async () => {
    setLoading(true)
    await logout()
    // logout() navigates away; if it somehow doesn't, don't leave the
    // button stuck disabled.
    setLoading(false)
    setConfirming(false)
  }, [logout])

  return { confirming, loading, requestLogout, cancel, confirm }
}
