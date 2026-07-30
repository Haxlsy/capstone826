import { createAdminClient } from "@/lib/supabase/admin"
import type { ApiLog } from "@/types/audit"

export async function getAuditLogs(limit = 500) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("audit_log")
    .select("id, user_id, user_name, role, category, action, target, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []) as ApiLog[]
}
