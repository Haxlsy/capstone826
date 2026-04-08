"use client"

import { useCurrentUser, getRoleLabel, getInitials } from "@/lib/hooks/useCurrentUser"
import NotificationBell, { NotificationItem } from "@/components/shared/NotificationBell"

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: "New customer inquiry",
    message: "Ana Reyes submitted a service inquiry via the website contact form.",
    time: "15m ago",
    read: false,
    type: "info",
  },
  {
    id: 2,
    title: "Job order approved",
    message: "Job Order #JO-2024-042 was approved by operations and is now active.",
    time: "45m ago",
    read: false,
    type: "success",
  },
  {
    id: 3,
    title: "Unread message",
    message: "Customer Carlo Reyes sent a message in Messenger. No reply in 2 hours.",
    time: "2h ago",
    read: false,
    type: "warning",
  },
  {
    id: 4,
    title: "Follow-up reminder",
    message: "Scheduled follow-up with customer Santos for today at 3:00 PM.",
    time: "4h ago",
    read: false,
    type: "info",
  },
  {
    id: 5,
    title: "Intake record updated",
    message: "Intake #IN-2024-089 status changed to In Progress by operations.",
    time: "1d ago",
    read: true,
    type: "info",
  },
]

export default function TopBar() {
  const user = useCurrentUser()

  const displayName = user.full_name || "Sales"
  const roleLabel = getRoleLabel(user.role) || "Sales"
  const initials = getInitials(displayName)

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 gap-5 shrink-0">
      <NotificationBell notifications={MOCK_NOTIFICATIONS} />
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gray-700 text-white text-xs font-semibold flex items-center justify-center">
          {initials}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-gray-800">{displayName}</span>
          <span className="text-xs text-gray-400">{roleLabel}</span>
        </div>
      </div>
    </header>
  )
}