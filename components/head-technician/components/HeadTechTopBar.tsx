"use client"

import NotificationBell from "@/components/shared/NotificationBell"

export default function HeadTechTopBar() {
  return (
    <header className="sticky top-0 z-40 h-12 bg-white/80 backdrop-blur border-b border-gray-100 flex items-center justify-end px-4 shrink-0">
      <NotificationBell />
    </header>
  )
}
