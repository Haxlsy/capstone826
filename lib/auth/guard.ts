import { cache } from "react"
import { cookies, headers } from "next/headers"
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

/**
 * Only `.id` is ever read by any caller (requireRole, getAdminCaller,
 * getAuditCaller, and the two direct callers below) — confirmed by grep.
 * Re-check that before adding a field: this trades the full Supabase `User`
 * for the minimal shape the trusted-header fast path (below) can actually
 * provide.
 */
export const getCurrentUser = cache(async (): Promise<{ id: string } | null> => {
  // proxy.ts already ran a network-verified getUser() for this exact request
  // and forwarded the result via this header — reuse it instead of paying for
  // the identical Supabase Auth round trip again a moment later.
  const headerStore = await headers()
  const trustedId = headerStore.get("x-verified-user-id")
  if (trustedId) return { id: trustedId }

  // No trusted header — proxy.ts's own `config.matcher` excludes /api, so
  // every API route reaches here with nothing set. Fall back to the original,
  // fully network-verified check; behavior for API routes is unchanged.
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { id: user.id } : null
})

// Memoized per-request (like getCurrentUser above) — requireRole() is called
// once per nested layout (e.g. the generic /dashboard layout AND the strict
// per-area layout under it), and without this the identical user_account
// query ran twice on every single navigation for no benefit.
const getCurrentUserProfile = cache(async (userId: string) => {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("role, must_change_password")
    .eq("id", userId)
    .single()
  return profile
})

export async function requireRole(allowedRoles: string[]) {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const profile = await getCurrentUserProfile(user.id)

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
