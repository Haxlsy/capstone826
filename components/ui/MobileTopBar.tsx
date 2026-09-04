"use client"

import Image from "next/image"
import NotificationBell from "@/components/shared/NotificationBell"

/** Slim dark top bar for the mobile-first head-technician portal. */
export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-between bg-shell px-4">
      <div className="flex items-center gap-2">
        <Image
          src="/assets/main-logo.png"
          alt="826"
          width={346}
          height={107}
          className="h-6 w-auto object-contain"
        />
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
          826 Auto Care
        </span>
      </div>
      <NotificationBell />
    </header>
  )
}
