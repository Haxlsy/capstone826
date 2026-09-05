import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth/guard"
import { createAdminClient } from "@/lib/supabase/admin"
import ForcedChangePasswordForm from "@/components/shared/ForcedChangePasswordForm"

const ROLE_HOMES: Record<string, string> = {
  super_admin: "/dashboard/admin",
  admin: "/dashboard/admin",
  operations: "/dashboard/operations",
  sales: "/dashboard/sales",
  head_detailer: "/head-technician",
  head_installer: "/head-technician",
}

// Deliberately outside the dashboard/head-technician layouts (and their
// requireRole() guard) so this page isn't itself subject to the redirect it
// exists to satisfy.
export default async function ChangePasswordRequiredPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("role, must_change_password")
    .eq("id", user.id)
    .single()

  if (!profile?.must_change_password) {
    redirect(ROLE_HOMES[profile?.role ?? ""] ?? "/")
  }

  return <ForcedChangePasswordForm role={profile.role} />
}
