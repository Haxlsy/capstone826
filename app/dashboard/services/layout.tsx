import { requireRole } from "@/lib/auth/guard"

export default async function ServicesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["operations"])

  return <>{children}</>
}
