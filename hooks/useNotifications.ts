"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface Notification {
  id: string
  type: string
  message: string
  job_order_id: string | null
  stage_id: string | null
  plate_number: string | null
  is_read: boolean
  created_at: string
}

type NotificationType = "rework" | "concern" | "concern_resolved" | "inquiry" | "job_assigned"

const TYPE_LABELS: Record<string, string> = {
  rework: "Rework Flagged",
  concern: "New Concern",
  concern_resolved: "Concern Resolved",
  inquiry: "New Inquiry",
  job_assigned: "New Assignment",
}

const TYPE_COLORS: Record<string, "info" | "warning" | "success"> = {
  rework: "warning",
  concern: "warning",
  concern_resolved: "success",
  inquiry: "info",
  job_assigned: "info",
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
  const [userId, setUserId] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {}
  }, [])

  const markOne = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      })
    } catch {}
  }, [])

  const markAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    try {
      await fetch("/api/notifications", { method: "PATCH" })
    } catch {}
  }, [])

  // Initial fetch + get userId for realtime
  useEffect(() => {
    fetchNotifications()

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [fetchNotifications])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notification",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [userId, fetchNotifications])

  return {
    notifications,
    unreadCount,
    markOne,
    markAll,
    refresh: fetchNotifications,
  }
}

export { TYPE_LABELS, TYPE_COLORS, relativeTime }
