import { requireRole } from "@/lib/auth/guard"

export default async function SalesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["sales"])

  return <>{children}</>
}
