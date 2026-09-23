"use client"

import { useEffect, useCallback, useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeRefetch, useRealtimeSubscription } from "@/hooks/useRealtimeRefetch"
import { emitAppEvent } from "@/lib/app-events"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { createSequenceGuard } from "@/lib/fetch-sequence"

export interface Notification {
  id: string
  type: string
  message: string
  job_order_id: string | null
  stage_id: string | null
  inquiry_id: string | null
  concern_id: string | null
  plate_number: string | null
  is_read: boolean
  created_at: string
}

type NotificationType = "rework" | "concern" | "concern_resolved" | "inquiry" | "job_assigned" | "job_status"

const TYPE_LABELS: Record<string, string> = {
  rework: "Rework Flagged",
  concern: "New Concern",
  concern_resolved: "Concern Resolved",
  inquiry: "New Inquiry",
  job_assigned: "New Assignment",
  job_status: "Job Update",
}

const TYPE_COLORS: Record<string, "info" | "warning" | "success"> = {
  rework: "warning",
  concern: "warning",
  concern_resolved: "success",
  inquiry: "info",
  job_assigned: "info",
  job_status: "info",
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return "just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [delayedJobCount, setDelayedJobCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const isOnline = useOnlineStatus()

  // Guards against a stale fetch (one already in flight when the bell was
  // clicked — e.g. this page's unfiltered `job_order` subscription below
  // fires on ANY job order changing, for ANY user) resolving after an
  // optimistic markOne/markAll and clobbering it with the older count —
  // the count would visibly jump back up, then settle down again on the
  // next real fetch. See lib/fetch-sequence.ts.
  const seqGuard = useRef(createSequenceGuard()).current

  const fetchNotifications = useCallback(async () => {
    const token = seqGuard.next()
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      if (!seqGuard.isCurrent(token)) return // superseded by a newer fetch or an optimistic update
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
      setDelayedJobCount(data.delayedJobCount ?? 0)
    } catch {}
  }, [seqGuard])

  // Recomputes the live delayed-job count (and picks up any job_status
  // notification) the moment any job order changes — separate from the
  // filtered `notification`-INSERT subscription below, which only fires for
  // this user's own rows.
  useRealtimeRefetch("job_order", fetchNotifications)

  const markOne = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    // Any fetch already in flight (e.g. from the unfiltered job_order
    // subscription) is now stale relative to this optimistic update — never
    // let it apply and overwrite the number just shown.
    seqGuard.invalidate()
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      })
    } catch {}
  }, [seqGuard])

  const markAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    seqGuard.invalidate()
    try {
      await fetch("/api/notifications", { method: "PATCH" })
    } catch {}
  }, [seqGuard])

  // Initial fetch + user id for the realtime filter. getSession() is a local
  // read (the id is only a filter — RLS does the real scoping), so a network
  // blip can't leave the bell without a subscription the way the previous
  // network getUser() + swallowed catch could.
  useEffect(() => {
    fetchNotifications()

    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id)
    }).catch((err) => console.warn("[notifications] getSession failed", err))
  }, [fetchNotifications, isOnline])

  // Realtime: new notifications for this user. Reconciled with a refetch after
  // any gap — the bell is exactly the thing that must not silently go stale.
  useRealtimeSubscription({
    name: "notifications",
    bindings: userId ? [{ event: "INSERT", table: "notification", filter: `user_id=eq.${userId}` }] : [],
    // A new notification also nudges screens that mirror what it announces
    // (Inquiry Management): this stream's RLS is trivial, so it is delivered
    // more reliably than the inquiry table's own change event.
    onChange: () => {
      fetchNotifications().finally(() => emitAppEvent("notification-arrived"))
    },
    onReconcile: fetchNotifications,
    catchUp: true,
    enabled: !!userId,
  })

  return {
    notifications,
    unreadCount,
    delayedJobCount,
    markOne,
    markAll,
    refresh: fetchNotifications,
  }
}

export { TYPE_LABELS, TYPE_COLORS, relativeTime }
