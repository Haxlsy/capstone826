import { cache } from "react"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getCurrentUser } from "@/lib/auth/guard"

export interface AuditCaller {
  /** Auth user id (also the user_account.id) */
  id: string
  full_name: string
  role: string
}

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized." }, { status: 401 })

const forbidden = () =>
  NextResponse.json({ error: "Forbidden." }, { status: 403 })

/**
 * Resolves the currently authenticated user together with their
 * `user_account` profile (full_name + role) for ANY signed-in role.
 *
 * This is the single source of truth for API-route auditing: it replaces
 * the per-route `getUser()` + `user_account` fetch blocks. It returns
 * `null` when no session exists or no profile row can be found.
 */
export const getAuditCaller = cache(async (): Promise<AuditCaller | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_account")
    .select("full_name, role, is_archived")
    .eq("id", user.id)
    .single()

  if (!profile || !profile.role) return null

  // An account archived while its owner is still signed in keeps a valid
  // session — treat it as no caller at all so every API route built on this
  // (getRoleCaller, requireAuditCaller) answers 401 instead of serving it.
  if (profile.is_archived === true) return null

  return {
    id:         user.id,
    full_name:  profile.full_name ?? "Unknown",
    role:       profile.role as string,
  }
})

/**
 * Convenience wrapper for routes that must return a 401 when no caller
 * exists. Returns `{ caller }` on success or `{ error }` to return.
 */
export async function requireAuditCaller(): Promise<
  { caller: AuditCaller } | { error: NextResponse }
> {
  const caller = await getAuditCaller()
  if (!caller) return { error: unauthorized() }
  return { caller }
}

/**
 * Resolves the currently authenticated caller AND verifies their role is one
 * of `allowedRoles` — 401 when not signed in, 403 when signed in with the
 * wrong role. This is the single source of truth for API-route role gating;
 * every /api/sales, /api/operations, and /api/head-technician route (plus
 * any /api/admin route not already using getAdminCaller) calls this before
 * touching the database, instead of each route re-deriving its own check
 * (or, as most did before, having none at all).
 */
export async function getRoleCaller(allowedRoles: string[]): Promise<
  { caller: AuditCaller } | { error: NextResponse }
> {
  const caller = await getAuditCaller()
  if (!caller) return { error: unauthorized() }
  if (!allowedRoles.includes(caller.role)) return { error: forbidden() }
  return { caller }
}

/**
 * Adapts the `AdminCaller` shape returned by `getAdminCaller()` (guard.ts)
 * into the plain `AuditCaller` shape expected by `logAuditCall`, so both
 * auth paths can share the same audit helper.
 */
export function auditCallerOf(caller: {
  user: { id: string }
  profile: { full_name: string; role: string }
}): AuditCaller {
  return {
    id:        caller.user.id,
    full_name: caller.profile.full_name,
    role:      caller.profile.role,
  }
}