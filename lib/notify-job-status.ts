import type { createAdminClient } from "@/lib/supabase/admin"
import { notifyRole } from "@/lib/notify-role"

/**
 * Operations' job pages aren't realtime, so every job-order status change is
 * announced to the Operations team through the bell (team decision: every
 * status update, not just some). One place owns the wording so the head-tech
 * routes and the Operations routes can't drift.
 */
export function jobStatusMessage(jobLabel: string, from: string | null | undefined, to: string): string {
  switch (to) {
    case "Pending":        return `Job ${jobLabel} is back to Pending.`
    case "Ongoing":        return `Job ${jobLabel} has been started (Ongoing).`
    case "For Inspection": return `Job ${jobLabel} is ready for inspection.`
    case "For Rework":     return `Job ${jobLabel} was sent back for rework.`
    case "For Release":    return `Job ${jobLabel} is ready for release.`
    case "Released":       return `Job ${jobLabel} has been released.`
    case "Completed":      return `Job ${jobLabel} has been completed.`
    case "Cancelled":      return `Job ${jobLabel} was cancelled.`
    default:               return from ? `Job ${jobLabel} status changed from ${from} to ${to}.` : `Job ${jobLabel} status changed to ${to}.`
  }
}

/**
 * Notifies every active Operations user EXCEPT the person who made the change.
 * No-op when nothing actually changed. Best-effort like notifyRole — never
 * throws, so it can't fail the status change itself.
 *
 * `message` overrides the standard wording (e.g. rework with instructions).
 */
export async function notifyJobStatusChange(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    jobId: string
    jobLabel: string
    from?: string | null
    to: string
    actorId?: string | null
    message?: string
    type?: "job_status" | "rework"
  },
): Promise<void> {
  if (opts.from && opts.from === opts.to) return
  await notifyRole(
    admin,
    "operations",
    {
      type:         opts.type ?? (opts.to === "For Rework" ? "rework" : "job_status"),
      message:      opts.message ?? jobStatusMessage(opts.jobLabel, opts.from, opts.to),
      job_order_id: opts.jobId,
    },
    { excludeUserId: opts.actorId ?? null },
  )
}

/** "Stage X done on Job Y (3/5 stages)" — progress is omitted when unknown. */
export function stageDoneMessage(
  jobLabel: string,
  stageName: string,
  opts: { done?: number; total?: number; reworkRound?: number } = {},
): string {
  const progress = opts.total && opts.done !== undefined ? ` (${opts.done}/${opts.total} stages)` : ""
  const what = opts.reworkRound && opts.reworkRound > 0 ? `Rework ${opts.reworkRound} of stage "${stageName}"` : `Stage "${stageName}"`
  return `${what} is done on job ${jobLabel}${progress}.`
}

/** Tells Operations a head technician finished a stage (not the person who did it). */
export async function notifyStageDone(
  admin: ReturnType<typeof createAdminClient>,
  opts: {
    jobId: string
    jobLabel: string
    stageId: string
    stageName: string
    done?: number
    total?: number
    reworkRound?: number
    actorId?: string | null
  },
): Promise<void> {
  await notifyRole(
    admin,
    "operations",
    {
      type:         "job_status",
      message:      stageDoneMessage(opts.jobLabel, opts.stageName, opts),
      job_order_id: opts.jobId,
      stage_id:     opts.stageId,
    },
    { excludeUserId: opts.actorId ?? null },
  )
}
