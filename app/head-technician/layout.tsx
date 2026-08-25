import { requireRole } from "@/lib/auth/guard"
import HeadTechTopBar from "@/components/head-technician/components/HeadTechTopBar"

export default async function HeadTechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["head_detailer", "head_installer"])

  return (
    <>
      <HeadTechTopBar />
      {children}
    </>
  )
}
