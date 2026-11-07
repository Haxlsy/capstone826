import { requireRole, getCurrentUserProfile } from "@/lib/auth/guard"
import { MobileTopBar } from "@/components/ui/MobileTopBar"
import { PushRegistration } from "@/components/head-technician/PushRegistration"
import { TemporaryAccessBanner } from "@/components/head-technician/TemporaryAccessBanner"
import { SessionEnforcement } from "@/components/shared/SessionEnforcement"
import { IdleTimeout } from "@/components/shared/IdleTimeout"
import { MfaEmailReminder } from "@/components/shared/MfaEmailReminder"

export default async function HeadTechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = await requireRole(["head_detailer", "head_installer"])
  // Cached: requireRole already loaded this profile, so no extra query.
  const profile = await getCurrentUserProfile(user.id)
  // A technician made Temporary Head by Operations for today only.
  const isTemporaryHead = profile?.is_temporary_head === true

  return (
    <div className="min-h-screen bg-surface-subtle">
      <SessionEnforcement />
      <IdleTimeout />
      {/* "Connect your email for login codes" makes no sense for a one-day
          login, so temporary heads don't get that prompt. */}
      {!isTemporaryHead && <MfaEmailReminder />}
      <PushRegistration />
      <MobileTopBar />
      {isTemporaryHead && <TemporaryAccessBanner />}
      {children}
    </div>
  )
}
