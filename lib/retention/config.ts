// Shared retention settings. Must match the CHECK constraint on
// shop_config.retention_months (supabase/migrations/20261122000001_data_retention.sql).

/** The periods an Admin can choose. Nothing under 3 months, so a slip can't wipe data. */
export const RETENTION_MONTH_CHOICES = [3, 6, 12, 24] as const
export type RetentionMonths = (typeof RETENTION_MONTH_CHOICES)[number]

/** The panel's recommendation, and the column default. */
export const DEFAULT_RETENTION_MONTHS: RetentionMonths = 6

/** After the period changes, nothing newly due is deleted sooner than this. */
export const RETENTION_CHANGE_GRACE_DAYS = 14

export function isRetentionMonths(n: unknown): n is RetentionMonths {
  return typeof n === "number" && (RETENTION_MONTH_CHOICES as readonly number[]).includes(n)
}

/**
 * The kinds of record retention covers, as stored in retention_notice.record_type.
 * Must match that column's CHECK constraint.
 */
export const RETENTION_RECORD_TYPES = [
  "job_record",
  "customer",
  "inquiry",
  "conversation",
  "audit_log",
  "notification",
  "user_account",
  "technician",
  "service",
] as const
export type RetentionRecordType = (typeof RETENTION_RECORD_TYPES)[number]
