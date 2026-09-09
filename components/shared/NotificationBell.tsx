"use client"

import { Bell, X, CheckCheck, AlertTriangle } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  useNotifications,
  TYPE_LABELS,
  TYPE_COLORS,
  relativeTime,
} from "@/hooks/useNotifications"
import type { Notification } from "@/hooks/useNotifications"
import { cn } from "@/lib/utils"

const dotStyles: Record<string, string> = {
  info: "bg-status-info",
  warning: "bg-status-warning",
  success: "bg-status-success",
}

export default function NotificationBell({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { notifications, unreadCount, delayedJobCount, markOne, markAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative rounded-md p-1.5 transition-colors",
          variant === "dark"
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "text-body hover:bg-surface-muted hover:text-heading",
        )}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {(unreadCount > 0 || delayedJobCount > 0) && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-delayed px-0.5 text-[9px] font-bold text-white">
            {/* Real unread notifications take priority; falls back to the live
                delayed-job count so the bell never sits silent while jobs are
                overdue with nothing new to "read". */}
            {unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : (delayedJobCount > 9 ? "9+" : delayedJobCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-card border border-border-subtle bg-surface shadow-pop">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-semibold text-heading">Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-body"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <ul className="max-h-80 divide-y divide-border-subtle overflow-y-auto">
            {delayedJobCount > 0 && (
              <li
                onClick={() => { setOpen(false); router.push("/dashboard/job-management") }}
                className="flex cursor-pointer items-start gap-3 bg-status-delayed/10 px-4 py-3 transition-colors hover:bg-status-delayed/15"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-delayed" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-heading">
                    {delayedJobCount} job{delayedJobCount !== 1 ? "s" : ""} currently delayed
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Tap to view Job Management</p>
                </div>
              </li>
            )}
            {notifications.length === 0 && delayedJobCount === 0 && (
              <li className="py-8 text-center text-sm text-muted">No notifications</li>
            )}
            {notifications.map((n: Notification) => {
              const color = TYPE_COLORS[n.type] ?? "info"
              return (
                <li
                  key={n.id}
                  onClick={() => markOne(n.id)}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-muted",
                    !n.is_read && "bg-primary-soft/40",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.is_read ? "bg-border" : dotStyles[color],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-tight",
                        n.is_read ? "font-normal text-body" : "font-medium text-heading",
                      )}
                    >
                      {TYPE_LABELS[n.type] ?? n.type}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.message}</p>
                  </div>
                  <span className="mt-0.5 shrink-0 text-[10px] text-muted">
                    {relativeTime(n.created_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
