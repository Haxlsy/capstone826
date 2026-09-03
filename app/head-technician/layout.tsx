import { requireRole } from "@/lib/auth/guard"
import { MobileTopBar } from "@/components/ui/MobileTopBar"

export default async function HeadTechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["head_detailer", "head_installer"])

  return (
    <div className="min-h-screen bg-surface-subtle">
      <MobileTopBar />
      {children}
    </div>
  )
}
