import { requireRole } from "@/lib/auth/guard"

export default async function HeadTechnicianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["head_detailer", "head_installer"])

  return <>{children}</>
}
