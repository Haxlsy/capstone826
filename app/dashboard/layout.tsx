import DashboardShell from "@/components/dashboard/DashboardShell"
import { requireRole } from "@/lib/auth/guard"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["super_admin", "admin", "operations", "sales"])

  return <DashboardShell>{children}</DashboardShell>
}
