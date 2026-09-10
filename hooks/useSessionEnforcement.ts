"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

// Single active session per account. proxy.ts already catches a stale
// session on every page navigation, but an idle tab that never navigates
// (the gap this closes) needs to be told proactively — a Realtime event on
// user_active_session says "something changed for my account, go check";
// the httpOnly 826_session_token cookie can't be read here directly, so the
// actual answer comes from /api/auth/session-status.
export function useSessionEnforcement() {
  const [userId, setUserId] = useState<string | null>(null)
  const loggingOutRef = useRef(false)

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
  // that was already stale before this hook even mounted.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
    checkStatus()
  }, [checkStatus])

  // Realtime subscription — fires the instant a login (this account, any
  // browser) writes a new session_token.
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel("session-enforcement")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_active_session",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          checkStatus()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, checkStatus])
}
