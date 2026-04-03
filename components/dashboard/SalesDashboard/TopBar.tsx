"use client"

import { Bell } from "lucide-react"
import { useCurrentUser, getRoleLabel, getInitials } from "@/lib/hooks/useCurrentUser"

export default function TopBar() {
  const user = useCurrentUser()

  const displayName = user.full_name || "Sales"
  const roleLabel = getRoleLabel(user.role) || "Sales"
  const initials = getInitials(displayName)

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-end px-6 gap-5 shrink-0">
      <div className="relative">
        <Bell className="w-5 h-5 text-gray-500" />
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          5
        </span>
      </div>
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
