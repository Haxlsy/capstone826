"use client"

import { useCurrentUser, getRoleLabel, getInitials } from "@/hooks/useCurrentUser"
import NotificationBell from "@/components/shared/NotificationBell"

export default function TopBar() {
  const user = useCurrentUser()

  const displayName = user.full_name || "Sales"
  const roleLabel = getRoleLabel(user.role) || "Sales"
  const initials = getInitials(displayName)

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 gap-5 shrink-0">
      <NotificationBell />
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