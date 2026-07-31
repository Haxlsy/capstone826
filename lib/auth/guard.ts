import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const ROLE_HOMES: Record<string, string> = {
  super_admin:    "/dashboard/admin",
  admin:          "/dashboard/admin",
  operations:     "/dashboard/operations",
  sales:          "/dashboard/sales",
  head_detailer:  "/head-technician",
  head_installer: "/head-technician",
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
})

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = profile?.role as string | undefined
  if (!role || !allowedRoles.includes(role)) {
    redirect(ROLE_HOMES[role ?? ""] ?? "/login")
  }

  return { user, role }
}
