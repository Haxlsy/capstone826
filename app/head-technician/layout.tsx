import { requireRole } from "@/lib/auth/guard"
import { MobileTopBar } from "@/components/ui/MobileTopBar"
import { PushRegistration } from "@/components/head-technician/PushRegistration"
import { SessionEnforcement } from "@/components/shared/SessionEnforcement"

export default async function HeadTechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["head_detailer", "head_installer"])

  return (
    <div className="min-h-screen bg-surface-subtle">
      <SessionEnforcement />
      <PushRegistration />
      <MobileTopBar />
      {children}
    </div>
  )
}
