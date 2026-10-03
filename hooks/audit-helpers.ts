import { TIME_ZONE } from "@/lib/time-display"
import { createAdminClient } from "@/lib/supabase/admin"
import { TimePeriod } from "@/types/audit"
import type { AuditCaller } from "@/lib/auth/caller"

export type AuditCategory = "auth" | "view" | "export" | "create" | "update" | "approve" | "flag" | "delete" | "message"

interface AuditParams {
  user_id:   string | null
  user_name: string
  role:      string
  category:  AuditCategory
  action:    string
  target?:   string
}

// Returns the insert's promise so callers in a serverless route handler can
// `await` it before responding — an unawaited fire-and-forget write here can
// get silently dropped if the function freezes/recycles right after return
// (see app/api/auth/login/route.ts's comment on the same issue). Callers that
// don't care about completion (e.g. client-side fetch helpers) may still
// leave it unawaited; this is purely additive.
export function logAudit(params: AuditParams): PromiseLike<void> {
  const admin = createAdminClient()
  return admin
    .from("audit_log")
    .insert({ ...params, target: params.target ?? "" })
    .then(
      // supabase-js resolves `{ error }` on a failed insert rather than
      // rejecting, so the rejection handler alone never saw DB failures.
      ({ error }) => {
        if (error) console.error("[audit] insert failed:", error.message, "-", params.action)
      },
      (err: unknown) => console.error("[audit]", err)
    )
}

/**
 * Convenience wrapper that fills in user_id / user_name / role from the
 * already-resolved caller (see `getAuditCaller` in lib/auth/caller), so
 * routes can audit with a single call: `await logAuditCall(caller, opts)`.
 */
export function logAuditCall(
  caller: AuditCaller,
  opts: { category: AuditCategory; action: string; target?: string }
): PromiseLike<void> {
  return logAudit({
    user_id:   caller.id,
    user_name: caller.full_name,
    role:      caller.role,
    category:  opts.category,
    action:    opts.action,
    target:    opts.target,
  })
}
  
export function startOfPeriod(period: TimePeriod): Date | null {
  if (period === "all") return null
  const now = new Date()
  if (period === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay()) // Sunday
    d.setHours(0, 0, 0, 0)
    return d
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: TIME_ZONE,
  })
}

