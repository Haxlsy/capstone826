"use client"

import { Bell, X, CheckCheck } from "lucide-react"
import { useState, useRef, useEffect } from "react"

export interface NotificationItem {
  id: number
  title: string
  message: string
  time: string
  read: boolean
  type: "info" | "warning" | "success"
}

interface Props {
  notifications: NotificationItem[]
}

const typeStyles: Record<NotificationItem["type"], string> = {
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  success: "bg-green-500",
}

export default function NotificationBell({ notifications: initial }: Props) {
  const [items, setItems] = useState<NotificationItem[]>(initial)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read).length

  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markOne(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  // Close on outside click
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
        className="relative p-1 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-500" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {items.length === 0 && (
              <li className="py-8 text-center text-sm text-gray-400">No notifications</li>
            )}
            {items.map((n) => (
              <li
                key={n.id}
                onClick={() => markOne(n.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  !n.read ? "bg-blue-50/50" : ""
                }`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    n.read ? "bg-gray-300" : typeStyles[n.type]
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${n.read ? "text-gray-500 font-normal" : "text-gray-800 font-medium"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                </div>
                <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{n.time}</span>
              </li>
            ))}
          </ul>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 text-center">
            <button className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  )
}