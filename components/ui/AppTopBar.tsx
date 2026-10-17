"use client"

import Image from "next/image"
import { Menu } from "lucide-react"
import NotificationBell from "@/components/shared/NotificationBell"
import { useCurrentUser, getInitials } from "@/hooks/useCurrentUser"
import { roleLabel } from "@/lib/ui/roles"

export function AppTopBar({
  fallbackName = "User",
  showBell = true,
  onOpenNav,
}: {
  fallbackName?: string
  showBell?: boolean
  /** Opens the sidebar drawer — the menu button only shows below 768px. */
  onOpenNav?: () => void
}) {
  const user = useCurrentUser()
  const displayName = user.full_name || fallbackName
  const label = roleLabel(user.role) || fallbackName

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-shell px-4 text-white md:gap-5 md:px-6">
      {onOpenNav && (
        <div className="flex min-w-0 items-center gap-2.5 md:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={onOpenNav}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image
            src="/assets/main-logo.png"
            alt="826"
            width={342}
            height={100}
            className="h-4 w-auto shrink-0 object-contain"
          />
        </div>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-3 md:gap-5">
        {showBell && <NotificationBell />}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
            {getInitials(displayName)}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-[40vw] truncate text-sm font-semibold text-white md:max-w-xs">{displayName}</span>
            <span className="truncate text-xs text-white/60">{label}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
