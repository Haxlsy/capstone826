"use client"

import * as React from "react"
import { AppSidebar, type NavItem } from "./AppSidebar"
import { AppTopBar } from "./AppTopBar"
import { OfflineBanner } from "@/components/shared/OfflineBanner"

/**
 * Dashboard shell: dark ground + dark sidebar + dark top bar, with the page
 * content on a white surface that has a large top-left corner radius
 * (per the Operations reference mockups).
 *
 * Below 768px the sidebar is an off-canvas drawer opened from the top bar's
 * menu button; from 768px up it sits in the layout (see AppSidebar).
 */
export function AppShell({
  nav,
  settingsContent,
  fallbackName,
  showBell = true,
  showOfflineBanner = false,
  lockSettingsOffline = false,
  children,
}: {
  nav: NavItem[]
  /** Rendered inside the Settings popup — small enough per-role content
   *  (change password, plus Operations' offline-sync section) that a full
   *  navigation page was overkill for it. */
  settingsContent: React.ReactNode
  fallbackName?: string
  showBell?: boolean
  /** Operations-only for now — see docs/plan/operations-offline-mode-plan.md */
  showOfflineBanner?: boolean
  /** Operations-only — grey out the Settings button while offline. */
  lockSettingsOffline?: boolean
  children: React.ReactNode
}) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const closeMobileNav = React.useCallback(() => setMobileNavOpen(false), [])

  return (
    <div className="flex h-dvh overflow-hidden bg-shell">
      <AppSidebar
        nav={nav}
        settingsContent={settingsContent}
        lockSettingsOffline={lockSettingsOffline}
        mobileOpen={mobileNavOpen}
        onMobileClose={closeMobileNav}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar fallbackName={fallbackName} showBell={showBell} onOpenNav={() => setMobileNavOpen(true)} />
        {showOfflineBanner && <OfflineBanner />}
        <main className="flex-1 overflow-x-auto overflow-y-auto bg-surface-subtle md:rounded-tl-panel">{children}</main>
      </div>
    </div>
  )
}
