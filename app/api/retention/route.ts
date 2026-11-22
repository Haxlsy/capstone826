import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuditCaller } from "@/lib/auth/caller"
import { loadRetentionPolicy } from "@/lib/retention/run"
import { RETENTION_MONTH_CHOICES, RETENTION_CHANGE_GRACE_DAYS } from "@/lib/retention/config"

/**
 * GET /api/retention: the data-retention policy, for any signed-in user.
 * Pages use it for the archive warning, "Deletes after" dates, the
 * "Expiring soon" filters and the Settings section.
 */
export async function GET() {
  try {
    const auth = await requireAuditCaller()
    if ("error" in auth) return auth.error
    const policy = await loadRetentionPolicy(createAdminClient())
    return NextResponse.json({
      months: policy.months,
      changedAt: policy.changedAt,
      choices: RETENTION_MONTH_CHOICES,
      graceDays: RETENTION_CHANGE_GRACE_DAYS,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
