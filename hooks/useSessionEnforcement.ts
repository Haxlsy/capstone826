"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeSubscription } from "@/hooks/useRealtimeRefetch"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { isDeadSessionError } from "@/lib/auth/refresh-errors"

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
        const reason = json?.reason === "mismatch" ? "?reason=signed_in_elsewhere" : ""
        window.location.href = `/login${reason}`
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
}
