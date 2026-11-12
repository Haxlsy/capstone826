import type { createAdminClient } from "@/lib/supabase/admin"
import { ACTIVE_JOB_STATUSES, computeStageDelays, isJobDelayed, type StageForDelay } from "@/lib/job-delay"
import { loadStageCatalog, resolveJobStage, STAGE_OVERRIDE_COLUMNS, type JobStageRow } from "@/lib/job-stages"
import { loadWorkSchedule } from "@/lib/operating-hours"
import { fmtDateTimeShort } from "@/lib/time-display"
import { notifyRole } from "@/lib/notify-role"
import { sendPushToUser } from "@/lib/push/send"
import type { WorkSchedule } from "@/hooks/time-utils"

/**
 * Delay notifications. A job or stage becomes late just by time passing, so
 * nothing happens at that moment that could send a notification. Instead a
 * scheduled check (app/api/cron/job-delays, every 5 minutes) finds delays and
 * announces each one exactly once. The `job_delay_alert` table remembers what
 * was already announced.
 *
 * "Delayed" is decided by lib/job-delay.ts, the same rule every badge and
 * count uses, so a notification never disagrees with what the screens show.
 */

/** Delays that started longer ago than this are not announced. This keeps the
 *  first run (and a run after an outage) from flooding everyone with old
 *  overdue jobs, which still show in the live "N jobs delayed" count. */
export const DELAY_ALERT_MAX_AGE_MS = 24 * 60 * 60 * 1000

const HEAD_ROLES = ["head_detailer", "head_installer"] as const
type HeadRole = (typeof HEAD_ROLES)[number]

export interface DelayJob {
  id: string
  status: string
  job_order_code: string | null
  actual_start_at: string | null
  expected_completion_at: string | null
}

export interface DelayStage {
  id: string
  job_order_id: string
  status: string
  name: string
  sequence_order: number
  stage_duration_mins: number | null
  template_duration_mins: number | null
  /** The stage category's technician_role: "detailer" | "installer" | null. */
  category_role: string | null
  current_rework_round: number | null
}

export interface DelayTeamMember {
  job_order_id: string
  user_account_id: string | null
  role_in_job: string
}

export interface DelayAlert {
  job_order_id: string
  alert_key: string
  kind: "job" | "stage"
  /** Head technicians to tell (Operations is told about every alert). */
  head_ids: string[]
  message: string
}

function jobLabel(job: DelayJob): string {
  return job.job_order_code ?? job.id
}

/** "Job JO-0012 is past its deadline (due Nov 12, 3:00 PM)." */
export function jobDelayMessage(job: DelayJob): string {
  return `Job ${jobLabel(job)} is past its deadline (due ${fmtDateTimeShort(job.expected_completion_at)}).`
}

/** "Stage "Ceramic Coating" on job JO-0012 is running late (expected done by Nov 12, 3:00 PM)." */
export function stageDelayMessage(job: DelayJob, stageName: string, expectedEndAt: string): string {
  return `Stage "${stageName}" on job ${jobLabel(job)} is running late (expected done by ${fmtDateTimeShort(expectedEndAt)}).`
}

/**
 * Every delay that should be announced right now, before de-duplication
 * (the caller drops keys already in job_delay_alert).
 *
 * - Job alert: the job is past its expected_completion_at. Keyed by that
 *   deadline, so extending it and running late again alerts again. Goes to
 *   every head on the job.
 * - Stage alert: a stage is past its expected end. Keyed by stage, expected
 *   end and rework round. Goes to the head whose role owns the stage's
 *   category, or to every head when the job has none of that role.
 *
 * Heads are the job_order_team rows with a head role and an account, so
 * substitute heads are included.
 */
export function findDelayAlerts(
  jobs: DelayJob[],
  stages: DelayStage[],
  team: DelayTeamMember[],
  schedule?: WorkSchedule,
  nowMs: number = Date.now(),
): DelayAlert[] {
  const stagesByJob = new Map<string, DelayStage[]>()
  for (const s of stages) {
    const list = stagesByJob.get(s.job_order_id) ?? []
    list.push(s)
    stagesByJob.set(s.job_order_id, list)
  }

  const headsByJob = new Map<string, { id: string; role: HeadRole }[]>()
  for (const t of team) {
    if (!t.user_account_id || !(HEAD_ROLES as readonly string[]).includes(t.role_in_job)) continue
    const list = headsByJob.get(t.job_order_id) ?? []
    if (!list.some((h) => h.id === t.user_account_id && h.role === t.role_in_job)) {
      list.push({ id: t.user_account_id, role: t.role_in_job as HeadRole })
    }
    headsByJob.set(t.job_order_id, list)
  }

  const isRecent = (iso: string) => nowMs - new Date(iso).getTime() <= DELAY_ALERT_MAX_AGE_MS
  const unique = (ids: string[]) => [...new Set(ids)]

  const alerts: DelayAlert[] = []
  for (const job of jobs) {
    if (!(ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status)) continue
    const heads = headsByJob.get(job.id) ?? []
    const allHeadIds = unique(heads.map((h) => h.id))

    if (job.expected_completion_at && isJobDelayed(job) && isRecent(job.expected_completion_at)) {
      alerts.push({
        job_order_id: job.id,
        alert_key: `job:${job.expected_completion_at}`,
        kind: "job",
        head_ids: allHeadIds,
        message: jobDelayMessage(job),
      })
    }

    const jobStages = stagesByJob.get(job.id) ?? []
    if (!job.actual_start_at || jobStages.length === 0) continue
    const shaped: StageForDelay[] = jobStages.map((s) => ({
      id: s.id,
      status: s.status,
      sequence_order: s.sequence_order,
      stage_duration_mins: s.stage_duration_mins,
      service_stage_duration_mins: s.template_duration_mins,
    }))
    const delays = computeStageDelays(shaped, job.actual_start_at, schedule)

    for (const s of jobStages) {
      const d = delays.get(s.id)
      if (!d?.is_delayed || !d.expected_end_at || !isRecent(d.expected_end_at)) continue
      const owner: HeadRole | null =
        s.category_role === "installer" ? "head_installer" : s.category_role === "detailer" ? "head_detailer" : null
      const owners = owner ? unique(heads.filter((h) => h.role === owner).map((h) => h.id)) : []
      alerts.push({
        job_order_id: job.id,
        alert_key: `stage:${s.id}:${d.expected_end_at}:${s.current_rework_round ?? 0}`,
        kind: "stage",
        head_ids: owners.length > 0 ? owners : allHeadIds,
        message: stageDelayMessage(job, s.name, d.expected_end_at),
      })
    }
  }
  return alerts
}

type Admin = ReturnType<typeof createAdminClient>

/**
 * Loads active jobs, finds delays, records the new ones and notifies (bell +
 * web push) the heads and Operations. Only alerts this run actually inserted
 * are announced, so overlapping runs never send the same alert twice.
 */
export async function runDelayAlertCheck(admin: Admin): Promise<{ checked: number; alerted: number }> {
  const { data: jobRows, error: jobError } = await admin
    .from("job_order")
    .select("id, status, job_order_code, actual_start_at, expected_completion_at")
    .in("status", ACTIVE_JOB_STATUSES as unknown as string[])
    .eq("is_archived", false)
  if (jobError) throw new Error(`job query failed: ${jobError.message}`)
  const jobs = (jobRows ?? []) as DelayJob[]
  if (jobs.length === 0) return { checked: 0, alerted: 0 }

  const jobIds = jobs.map((j) => j.id)
  const [stageResult, teamResult, schedule] = await Promise.all([
    admin
      .from("job_stage_progress")
      .select(`id, job_order_id, status, stage_duration_mins, current_rework_round, ${STAGE_OVERRIDE_COLUMNS}`)
      .in("job_order_id", jobIds),
    admin
      .from("job_order_team")
      .select("job_order_id, user_account_id, role_in_job")
      .in("job_order_id", jobIds)
      .in("role_in_job", HEAD_ROLES as unknown as string[]),
    loadWorkSchedule(admin),
  ])
  if (stageResult.error) throw new Error(`stage query failed: ${stageResult.error.message}`)
  if (teamResult.error) throw new Error(`team query failed: ${teamResult.error.message}`)

  type StageRow = JobStageRow & {
    id: string
    job_order_id: string
    status: string
    stage_duration_mins: number | null
    current_rework_round: number | null
  }
  const stageRows = (stageResult.data ?? []) as unknown as StageRow[]
  const catalog = await loadStageCatalog(admin, stageRows)
  const stages: DelayStage[] = stageRows.map((row) => {
    const r = resolveJobStage(row, catalog)
    return {
      id: row.id,
      job_order_id: row.job_order_id,
      status: row.status,
      name: r.name ?? "Stage",
      sequence_order: r.sequence_order ?? 0,
      stage_duration_mins: row.stage_duration_mins,
      template_duration_mins: r.template_duration_mins,
      category_role: r.category?.technician_role ?? null,
      current_rework_round: row.current_rework_round,
    }
  })

  const candidates = findDelayAlerts(jobs, stages, (teamResult.data ?? []) as DelayTeamMember[], schedule)
  if (candidates.length === 0) return { checked: jobs.length, alerted: 0 }

  const { data: inserted, error: insertError } = await admin
    .from("job_delay_alert")
    .upsert(
      candidates.map((a) => ({ job_order_id: a.job_order_id, alert_key: a.alert_key })),
      { onConflict: "job_order_id,alert_key", ignoreDuplicates: true },
    )
    .select("job_order_id, alert_key")
  if (insertError) throw new Error(`alert insert failed: ${insertError.message}`)

  const isNew = new Set((inserted ?? []).map((r) => `${r.job_order_id}|${r.alert_key}`))
  const fresh = candidates.filter((a) => isNew.has(`${a.job_order_id}|${a.alert_key}`))
  if (fresh.length === 0) return { checked: jobs.length, alerted: 0 }

  const { data: opsUsers } = await admin
    .from("user_account")
    .select("id")
    .eq("role", "operations")
    .eq("is_archived", false)
  const opsIds = (opsUsers ?? []).map((u) => u.id as string)

  for (const alert of fresh) {
    const title = alert.kind === "job" ? "Job delayed" : "Stage running late"
    try {
      if (alert.head_ids.length > 0) {
        await admin.from("notification").insert(
          alert.head_ids.map((id) => ({
            user_id:      id,
            type:         "delayed",
            message:      alert.message,
            job_order_id: alert.job_order_id,
            is_read:      false,
          })),
        )
      }
      await notifyRole(admin, "operations", { type: "delayed", message: alert.message, job_order_id: alert.job_order_id })
      await Promise.all([
        ...alert.head_ids.map((id) =>
          sendPushToUser(id, { title, body: alert.message, url: `/head-technician/${alert.job_order_id}` }),
        ),
        ...opsIds.map((id) =>
          sendPushToUser(id, { title, body: alert.message, url: `/dashboard/job-management/${alert.job_order_id}` }),
        ),
      ])
    } catch (err) {
      console.error("[job-delay-alerts] notifying failed for", alert.job_order_id, alert.alert_key, err)
    }
  }

  return { checked: jobs.length, alerted: fresh.length }
}
