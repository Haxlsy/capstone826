import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminCaller } from "@/lib/auth/guard"
import { countAnchoredBefore, loadRetentionPolicy } from "@/lib/retention/run"
import { addMonths, dueCutoff } from "@/lib/retention/plan"
import { isRetentionMonths, RETENTION_CHANGE_GRACE_DAYS } from "@/lib/retention/config"

export const maxDuration = 60

/**
 * GET /api/admin/retention/preview?months=3: what changing the period would
 * do, for the confirm dialog in Settings. Counts the records that would be
 * deleted when the 14-day safety period after the change ends, minus those
 * the current period deletes by then anyway.
 */
export async function GET(request: Request) {
  try {
    const auth = await getAdminCaller()
    if ("error" in auth) return auth.error

    const months = Number(new URL(request.url).searchParams.get("months"))
    if (!isRetentionMonths(months)) {
      return NextResponse.json({ error: "Choose 3, 6, 12 or 24 months." }, { status: 400 })
    }

    const admin = createAdminClient()
    const current = await loadRetentionPolicy(admin)
    const effective = new Date(Date.now() + RETENTION_CHANGE_GRACE_DAYS * 864e5)
    const proposed = await countAnchoredBefore(admin, addMonths(effective, -months))
    // Without the change, by the same day: only what the current rule makes
    // due then (its own safety period may still be running).
    const currentCutoff = dueCutoff(current, effective)
    const baseline = currentCutoff && months < current.months ? await countAnchoredBefore(admin, currentCutoff) : {}

    const sum = (c: Record<string, number | undefined>) => Object.values(c).reduce<number>((a, n) => a + (n ?? 0), 0)
    const extra = months < current.months ? Math.max(0, sum(proposed) - sum(baseline)) : 0
    return NextResponse.json({
      months,
      currentMonths: current.months,
      effectiveOn: effective.toISOString(),
      /** Records newly due because of the change (0 when lengthening). */
      newlyDue: extra,
      /** Everything due under the new period on that day, by kind. */
      dueByType: proposed,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
