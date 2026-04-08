"use client"

import { useCurrentUser, getRoleLabel, getInitials } from "@/lib/hooks/useCurrentUser"
import NotificationBell, { NotificationItem } from "@/components/shared/NotificationBell"

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: "New intake submitted",
    message: "Customer Juan Dela Cruz submitted a new intake request. Awaiting review.",
    time: "10m ago",
    read: false,
    type: "info",
  },
  {
    id: 2,
    title: "Job order overdue",
    message: "Job Order #JO-2024-041 has passed its target completion date.",
    time: "1h ago",
    read: false,
    type: "warning",
  },
  {
    id: 3,
    title: "Technician assigned",
    message: "Tech Roel Mendoza was assigned to Job Order #JO-2024-038.",
    time: "3h ago",
    read: false,
    type: "success",
  },
  {
    id: 4,
    title: "Job order completed",
    message: "Job Order #JO-2024-035 was marked as completed by the head technician.",
    time: "5h ago",
    read: true,
    type: "success",
  },
  {
    id: 5,
    title: "Parts request pending",
    message: "A parts request for Job Order #JO-2024-033 needs your approval.",
    time: "1d ago",
    read: true,
    type: "warning",
  },
]

export default function OperationsTopBar() {
  const user = useCurrentUser()

  const displayName = user.full_name || "Operations"
  const roleLabel = getRoleLabel(user.role) || "Operations"
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