import { createAdminClient } from "@/lib/supabase/admin"
import { TimePeriod } from "@/types/audit"

type AuditCategory = "auth" | "view" | "create" | "update" | "approve" | "flag" | "delete" | "message"

interface AuditParams {
  user_id:   string | null
  user_name: string
  role:      string
  category:  AuditCategory
  action:    string
  target?:   string
}

export function logAudit(params: AuditParams): void {
  const admin = createAdminClient()
  admin
    .from("audit_log")
    .insert({ ...params, target: params.target ?? "" })
    .then(
      () => {},
      (err: unknown) => console.error("[audit]", err)
    )
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
  })
}

