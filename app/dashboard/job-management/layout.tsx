import { requireRole } from "@/lib/auth/guard"

export default async function JobManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["operations"])

  return <>{children}</>
}
