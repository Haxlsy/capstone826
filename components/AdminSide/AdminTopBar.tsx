"use client"

import { useCurrentUser, getRoleLabel, getInitials } from "@/hooks/useCurrentUser"
import NotificationBell, { NotificationItem } from "@/components/shared/NotificationBell"

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    title: "New user registered",
    message: "A new staff account was created for Maria Santos (Sales role).",
    time: "5m ago",
    read: false,
    type: "info",
  },
  {
    id: 2,
    title: "System backup complete",
    message: "Scheduled daily backup finished successfully at 2:00 AM.",
    time: "2h ago",
    read: false,
    type: "success",
  },
  {
    id: 3,
    title: "Unusual login detected",
    message: "Login from an unrecognized device for account admin@company.com.",
    time: "3h ago",
    read: false,
    type: "warning",
  },
  {
    id: 4,
    title: "Monthly report ready",
    message: "The March 2026 operations summary report is now available.",
    time: "1d ago",
    read: true,
    type: "info",
  },
  {
    id: 5,
    title: "Role permission updated",
    message: "Permissions for the Technician role were modified by admin.",
    time: "2d ago",
    read: true,
    type: "info",
  },
]

export default function AdminTopBar() {
  const user = useCurrentUser()

  const displayName = user.full_name || "Admin"
  const roleLabel = getRoleLabel(user.role) || "Admin"
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