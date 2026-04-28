import { createAdminClient } from "@/lib/supabase/admin"

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
