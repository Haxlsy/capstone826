"use client"

import { usePathname } from "next/navigation"
import { AppShell } from "@/components/ui/AppShell"
import { useConcerns } from "@/hooks/use-concerns"
import { resolveNavArea, navFor } from "@/lib/ui/nav"
import { OfflineSyncProvider } from "@/components/dashboard/OperationComponents/OfflineSyncContext"
import { SessionEnforcement } from "@/components/shared/SessionEnforcement"
import { IdleTimeout } from "@/components/shared/IdleTimeout"
import { ServiceWorkerRegistration } from "@/components/shared/ServiceWorkerRegistration"
import ChangePasswordSettings from "@/components/shared/ChangePasswordSettings"
import OfflineSyncSettings from "@/components/dashboard/OperationComponents/OfflineSyncSettings"

/**
 * Single dashboard shell for operations / sales / admin. The nav config is
 * chosen by pathname (same routing rule the old DynamicSidebar used). The
 * Concerns badge count is injected for the operations nav.
 */
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const area = resolveNavArea(pathname)
  const { nav, fallbackName, showBell } = navFor(area)

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

  const shell = (
    <AppShell
      nav={resolvedNav}
      settingsContent={<ChangePasswordSettings extraSection={area === "operations" ? <OfflineSyncSettings /> : undefined} />}
      fallbackName={fallbackName}
      showBell={showBell}
      showOfflineBanner={area === "operations"}
      lockSettingsOffline={area === "operations"}
    >
      <SessionEnforcement />
      <IdleTimeout />
      <ServiceWorkerRegistration prewarm={area === "operations"} />
      {children}
    </AppShell>
  )

  // Must wrap the whole shell, not just `children` — the Settings modal's
  // Operations-only OfflineSyncSettings section renders inside AppSidebar
  // (a sibling of `children` here), so it needs to be a descendant of the
  // provider too, not just the page content.
  return area === "operations" ? <OfflineSyncProvider>{shell}</OfflineSyncProvider> : shell
}
