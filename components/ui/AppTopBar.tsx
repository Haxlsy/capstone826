"use client"

import NotificationBell from "@/components/shared/NotificationBell"
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser"
import { roleLabel } from "@/lib/ui/roles"

export function AppTopBar({
  fallbackName = "User",
  showBell = true,
}: {
  fallbackName?: string
  showBell?: boolean
}) {
  const user = useCurrentUser()
  const displayName = user.full_name || fallbackName
  const label = roleLabel(user.role) || fallbackName

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-5 bg-shell px-6 text-white">
      {showBell && <NotificationBell />}
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
          {getInitials(displayName)}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-white">{displayName}</span>
          <span className="text-xs text-white/60">{label}</span>
        </div>
      </div>
    </header>
  )
}
