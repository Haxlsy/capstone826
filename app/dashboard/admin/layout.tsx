import { requireRole } from "@/lib/auth/guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["super_admin", "admin"])

  return <>{children}</>
}
