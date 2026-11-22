// The wording users see about data retention, in one place so every archive
// dialog, badge and Settings line says the same thing. The period always
// comes from the Admin's setting, never a hard-coded "6 months".

import { DEFAULT_RETENTION_MONTHS } from "./config"

export function periodLabel(months: number | null | undefined): string {
  const m = months ?? DEFAULT_RETENTION_MONTHS
  return m % 12 === 0 && m >= 12 ? `${m / 12} year${m === 12 ? "" : "s"}` : `${m} months`
}

/** Shown in every archive confirmation. */
export function archiveWarning(months: number | null | undefined): string {
  return `Archived items are permanently deleted after ${periodLabel(months)} unless restored. Export anything you need first.`
}

/** The policy line shown to everyone in Settings. */
export function policySummary(months: number | null | undefined): string {
  return `Records are kept for ${periodLabel(months)} after they're last used, then permanently deleted.`
}

/** What each kind of record's clock starts from, for Settings. */
export const RETENTION_SCOPE: { label: string; from: string }[] = [
  { label: "Job records", from: "the day the job is released" },
  { label: "Customer records", from: "the customer's last visit or edit (never while a job is active)" },
  { label: "Inquiries", from: "the day the inquiry is resolved" },
  { label: "Messenger conversations", from: "the last message (never while waiting for staff)" },
  { label: "Audit trail and security logs", from: "the day the entry is recorded" },
  { label: "Archived accounts, technicians and services", from: "the day they're archived (restoring cancels it)" },
]

const DATE_FMT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }
export const fmtRetentionDate = (d: Date) => d.toLocaleDateString("en-PH", DATE_FMT)
