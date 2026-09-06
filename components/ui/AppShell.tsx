import * as React from "react"
import { AppSidebar, type NavItem } from "./AppSidebar"
import { AppTopBar } from "./AppTopBar"

/**
 * Dashboard shell: dark ground + dark sidebar + dark top bar, with the page
 * content on a white surface that has a large top-left corner radius
 * (per the Operations reference mockups).
 */
export function AppShell({
  nav,
  settingsHref,
  fallbackName,
  showBell = true,
  children,
}: {
  nav: NavItem[]
  settingsHref: string
  fallbackName?: string
  showBell?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-shell">
      <AppSidebar nav={nav} settingsHref={settingsHref} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopBar fallbackName={fallbackName} showBell={showBell} />
        <main className="flex-1 overflow-x-auto overflow-y-auto rounded-tl-panel bg-surface-subtle">{children}</main>
      </div>
    </div>
  )
}
