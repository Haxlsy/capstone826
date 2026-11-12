import type { createAdminClient } from "@/lib/supabase/admin"
import { headCoverage, headWarningText, type HeadOnJob, type HeadRole } from "@/lib/operations/head-coverage"

type Admin = ReturnType<typeof createAdminClient>

export const HEAD_ROLES = ["head_detailer", "head_installer"] as const
const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/** A head technician account with its availability (never the full user_account row). */
export interface HeadAccount {
  id: string
  full_name: string
  role: string
  is_archived: boolean
  available_days: string[]
  work_start_time: string
  work_end_time: string
  is_available: boolean
  availability_override_date: string | null
}

const BASE = "id, full_name, role, is_archived"
const AVAILABILITY = "available_days, work_start_time, work_end_time, is_available, availability_override_date"

function toHead(r: Record<string, unknown>): HeadAccount {
  return {
    id: r.id as string,
    full_name: (r.full_name as string) ?? "Unknown",
    role: r.role as string,
    is_archived: r.is_archived === true,
    available_days: (r.available_days as string[] | undefined) ?? ALL_DAYS,
    work_start_time: (r.work_start_time as string | undefined) ?? "08:00:00",
    work_end_time: (r.work_end_time as string | undefined) ?? "20:00:00",
    is_available: (r.is_available as boolean | undefined) ?? true,
    availability_override_date: (r.availability_override_date as string | null | undefined) ?? null,
  }
}

/**
 * Head technician accounts with their availability.
 *  - `ids`: exactly these accounts, whatever their role or archive state now
 *    (a job's assigned heads, so a head archived or moved to another role
 *    since being assigned still shows up and is judged unavailable).
 *  - no `ids`: every active (not archived) head technician account.
 *
 * Works before the availability migration has run (20261112000001): a missing
 * column (42703) falls back to the base columns with "available every day",
 * so nothing warns and no page breaks.
 */
export async function loadHeadAccounts(admin: Admin, opts: { ids?: string[] } = {}): Promise<HeadAccount[]> {
  if (opts.ids && opts.ids.length === 0) return []
  const build = (columns: string) => {
    let q = admin.from("user_account").select(columns)
    if (opts.ids) q = q.in("id", opts.ids)
    else q = q.in("role", HEAD_ROLES as unknown as string[]).eq("is_archived", false).order("role").order("full_name")
    return q
  }
  let { data, error } = await build(`${BASE}, ${AVAILABILITY}`)
  if (error?.code === "42703") ({ data, error } = await build(BASE))
  if (error) {
    console.error("[head-accounts] query failed:", error.message)
    return []
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toHead)
}

/**
 * The heads assigned to each job (primary and substitutes), with availability,
 * ready for headCoverage(). One account query for any number of jobs.
 */
export async function loadHeadsOnJobs(
  admin: Admin,
  teamRows: { job_order_id: string; role_in_job: string; user_account_id: string | null }[],
): Promise<Map<string, HeadOnJob[]>> {
  const rows = teamRows.filter(
    (r): r is typeof r & { user_account_id: string; role_in_job: HeadRole } =>
      !!r.user_account_id && (HEAD_ROLES as readonly string[]).includes(r.role_in_job),
  )
  const accounts = await loadHeadAccounts(admin, { ids: [...new Set(rows.map((r) => r.user_account_id))] })
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const out = new Map<string, HeadOnJob[]>()
  for (const r of rows) {
    const account = byId.get(r.user_account_id)
    if (!account) continue
    const list = out.get(r.job_order_id) ?? []
    // A person can have a primary and a substitute row for the same slot.
    if (!list.some((h) => h.id === account.id && h.role_in_job === r.role_in_job)) {
      list.push({ ...account, role_in_job: r.role_in_job })
    }
    out.set(r.job_order_id, list)
  }
  return out
}

/**
 * Warning sentences per job for a job order list: one per head role with no
 * available head (an empty list = fine). Shared by the list's first render
 * (lib/operations/job-orders-data.ts) and its refresh (list-job-orders).
 */
export async function loadHeadWarningTexts(
  admin: Admin,
  jobs: { id: string; status: string; scheduled_at: string | null }[],
  teamRows: { job_order_id: string; role_in_job: string; user_account: unknown }[],
): Promise<Map<string, string[]>> {
  const headsOnJobs = await loadHeadsOnJobs(
    admin,
    teamRows.map((t) => ({
      job_order_id: t.job_order_id,
      role_in_job: t.role_in_job,
      user_account_id: ((Array.isArray(t.user_account) ? t.user_account[0] : t.user_account) as { id?: string } | null)?.id ?? null,
    })),
  )
  const out = new Map<string, string[]>()
  for (const j of jobs) {
    const texts = headCoverage(j, headsOnJobs.get(j.id) ?? []).map(headWarningText)
    if (texts.length > 0) out.set(j.id, texts)
  }
  return out
}
