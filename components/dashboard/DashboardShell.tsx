"use client"

import { usePathname } from "next/navigation"
import { AppShell } from "@/components/ui/AppShell"
import { useConcerns } from "@/hooks/use-concerns"
import { resolveNavArea, navFor } from "@/lib/ui/nav"
import { OfflineSyncProvider } from "@/components/dashboard/OperationComponents/OfflineSyncContext"
import { SessionEnforcement } from "@/components/shared/SessionEnforcement"
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration"

/**
 * Single dashboard shell for operations / sales / admin. The nav config is
 * chosen by pathname (same routing rule the old DynamicSidebar used). The
 * Concerns badge count is injected for the operations nav.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const area = resolveNavArea(pathname)
  const { nav, settingsHref, fallbackName, showBell } = navFor(area)

  // Only Operations shows the Concerns nav badge, and only Operations may read
  // /api/operations/job-concerns — Sales/Admin used to fire it on every page and
  // just collect 403s.
  const { data: concerns } = useConcerns(undefined, { enabled: area === "operations" })
  const pendingConcerns = (concerns ?? []).filter((c) => c.status === "Pending").length

  const resolvedNav =
    area === "operations"
      ? nav.map((item) =>
          item.label === "Concerns" ? { ...item, badge: pendingConcerns } : item,
        )
      : nav

  return (
    <AppShell
      nav={resolvedNav}
      settingsHref={settingsHref}
      fallbackName={fallbackName}
      showBell={showBell}
      showOfflineBanner={area === "operations"}
      lockSettingsOffline={area === "operations"}
    >
      <SessionEnforcement />
      <ServiceWorkerRegistration prewarm={area === "operations"} />
      {area === "operations" ? <OfflineSyncProvider>{children}</OfflineSyncProvider> : children}
    </AppShell>
  )
}
