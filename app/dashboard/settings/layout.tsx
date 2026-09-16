import { requireRole } from "@/lib/auth/guard"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRole(["sales"])

  return <>{children}</>
}
