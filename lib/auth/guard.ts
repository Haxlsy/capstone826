import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
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
    .select("role, must_change_password")
    .eq("id", user.id)
    .single()

  const role = profile?.role as string | undefined
  if (!role || !allowedRoles.includes(role)) {
    redirect(ROLE_HOMES[role ?? ""] ?? "/login")
  }

  if (profile?.must_change_password) {
    redirect("/change-password-required")
  }

  return { user, role }
}

// ===================================================================
// API-route hardening helpers
// ===================================================================

export interface AdminCaller {
  user: { id: string }
  profile: { full_name: string; role: string }
}

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized." }, { status: 401 })

const forbidden = () =>
  NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 })

/**
 * Resolves the currently authenticated admin/super-admin caller for API
 * route handlers. Returns `{ error }` (a ready-to-return NextResponse)
 * when the caller is not signed in, or signed in without the admin role.
 * Otherwise returns `{ caller }` with the profile needed for audit logs.
 *
 * This is the single source of truth for admin API auth; it replaces the
 * per-route `getUser()` + `user_account` role check pattern.
 */
export async function getAdminCaller(): Promise<
  { caller: AdminCaller } | { error: NextResponse }
> {
  const user = await getCurrentUser()
  if (!user) return { error: unauthorized() }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("full_name, role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: forbidden() }
  }

  return { caller: { user: { id: user.id }, profile } }
}
