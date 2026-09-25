"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeSubscription } from "@/hooks/useRealtimeRefetch"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { isDeadSessionError } from "@/lib/auth/refresh-errors"
import { redirectReasonFor } from "@/lib/auth/session-reasons"
import { startSessionPoll } from "@/lib/auth/session-poll"

// One /api/auth/session-status call (an Auth getUser + a small query) per
// visible tab per interval. Tunable here if Supabase Auth rate limits ever bite.
const SESSION_POLL_MS = 60_000

// Single active session per account. proxy.ts already catches a stale
// session on every page navigation, but an idle tab that never navigates
// (the gap this closes) needs to be told proactively — a Realtime event on
// user_active_session says "something changed for my account, go check";
// the httpOnly 826_session_token cookie can't be read here directly, so the
// actual answer comes from /api/auth/session-status.
export function useSessionEnforcement() {
  const [userId, setUserId] = useState<string | null>(null)
  const loggingOutRef = useRef(false)
  const isOnline = useOnlineStatus()

  const checkStatus = useCallback(async () => {
    if (loggingOutRef.current) return
    try {
      const res = await fetch("/api/auth/session-status", { cache: "no-store" })
      if (!res.ok) return // transient failure — not a confirmed stale session, don't act
      const json = await res.json()
      if (json?.valid === false) {
        loggingOutRef.current = true
        // "no_session" is just as much the normal shape of a deliberate
        // logout (this check can fire mid-logout, before that flow's own
        // redirect completes) as it is a naturally-expired session — only a
        // confirmed "mismatch" (a session that IS still valid, just not the
        // current one) means another device actually signed in. Hard
        // redirect either way, not router.push — tears down open realtime
        // channels/client state instead of a soft client-side transition
        // leaving stale connections behind.
        if (json?.reason === "archived") {
          // An admin archived this account while it was in use. The session
          // itself is still valid, so /login alone would just bounce back
          // (proxy.ts sends signed-in visitors to their dashboard) — this
          // route actually ends it, then lands on /login with the reason.
          window.location.href = "/api/auth/force-logout"
          return
        }
        const reason = redirectReasonFor(json?.reason)
        window.location.href = `/login${reason ? `?reason=${reason}` : ""}`
      }
    } catch {
      // Network blip — same reasoning, don't force a logout on ambiguity.
    }
  }, [])

  // Get the current user id, and run one check on mount — covers a tab
  // that was already stale before this hook even mounted. The id is only a
  // Realtime filter (RLS and /api/auth/session-status do the real
  // enforcement), so getSession() — a local read — is enough; getUser() was a
  // full round trip to Supabase Auth on every mount and reconnect. If the
  // browser client can't refresh because its refresh token is gone, this tab
  // is dead: one hard redirect to /login rather than sitting half-broken.
  // Only attempt it once we're confirmed online — this re-runs on reconnect
  // too — and never let it become an unhandled rejection.
  useEffect(() => {
    if (isOnline) {
      const supabase = createClient()
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (isDeadSessionError(error)) {
          if (loggingOutRef.current) return
          loggingOutRef.current = true
          window.location.href = "/login?reason=session_expired"
          return
        }
        if (session?.user) setUserId(session.user.id)
      }).catch(() => {})
    }
    checkStatus()
  }, [isOnline, checkStatus])

  // Fallback for the Realtime push below: also re-check whenever the tab
  // becomes visible and once a minute while it is, so a dropped WebSocket (or
  // a push that never arrived) can't leave a superseded tab logged in
  // indefinitely. See lib/auth/session-poll.ts. Timer functions are BOUND —
  // bare globals throw "Illegal invocation" when called as env.setInterval().
  useEffect(() => {
    if (!isOnline) return
    return startSessionPoll(
      {
        setInterval: setInterval.bind(globalThis),
        clearInterval: clearInterval.bind(globalThis),
        isVisible: () => document.visibilityState === "visible",
        onVisibilityChange: (cb) => {
          document.addEventListener("visibilitychange", cb)
          return () => document.removeEventListener("visibilitychange", cb)
        },
      },
      { intervalMs: SESSION_POLL_MS, onCheck: checkStatus },
    )
  }, [isOnline, checkStatus])

  // Realtime subscription — fires the instant a login (this account, any
  // browser) writes a new session_token. A missed event would leave a
  // superseded session logged in, so reconcile = re-check after any gap.
  useRealtimeSubscription({
    name: "session-enforcement",
    bindings: userId ? [{ event: "*", table: "user_active_session", filter: `user_id=eq.${userId}` }] : [],
    onChange: checkStatus,
    onReconcile: checkStatus,
    catchUp: true,
    enabled: !!userId,
  })

  // Neither of the two mechanisms above covers an in-page action (a Save, a
  // form submit — any fetch that isn't a page navigation) fired in the gap
  // between another device signing in and this tab's Realtime event arriving.
  // That fetch just gets a plain 401 from the API, which every component
  // would otherwise show as its own generic "Failed to ..." error instead of
  // the graceful "signed in on another device" message. So: patch fetch once
  // and treat a 401 from any of our own /api/* routes (except /api/auth/* —
  // a 401 there is an EXPECTED response, e.g. a wrong password on login, not
  // a sign that THIS session died) as a cue to run the exact same check the
  // Realtime path uses, which already knows how to tell "kicked out
  // elsewhere" from "simply expired" and already redirects with the right
  // reason.
  useEffect(() => {
    if (typeof window === "undefined") return
    // Guards against double-patching — SessionEnforcement is mounted once
    // per shell, but React 19 dev-mode double-invokes effects.
    const w = window as typeof window & { __sessionFetchPatched?: boolean }
    if (w.__sessionFetchPatched) return
    w.__sessionFetchPatched = true

    const originalFetch = window.fetch.bind(window)
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args)
      if (res.status === 401) {
        const input = args[0]
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
        try {
          const path = new URL(url, window.location.origin).pathname
          if (path.startsWith("/api/") && !path.startsWith("/api/auth/")) checkStatus()
        } catch {
          // Not a parseable same-origin URL — nothing to act on.
        }
      }
      return res
    }

    return () => {
      window.fetch = originalFetch
      w.__sessionFetchPatched = false
    }
  }, [checkStatus])
}
