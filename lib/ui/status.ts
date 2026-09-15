/**
 * Single source of truth for status → colour styling.
 *
 * Replaces the ~10 hand-duplicated status colour maps that used to live inside
 * StatusSummaryCards, QuickAccessPanel, JobCalendarView, StatusPickerModal,
 * JobOrderDetail, SalesJobDetail, SalesJobList, InquiryManagement,
 * head-technician/components/types.ts, etc.
 *
 * Class strings are written out in full (never interpolated) so the Tailwind v4
 * scanner picks them up. All colours are @theme tokens — no raw hex.
 */

export interface StatusStyle {
  /** canonical display label */
  label: string
  /** solid fill (stat-card style) */
  solid: string
  /** tinted pill */
  soft: string
  /** just the text colour */
  text: string
  /** border colour class */
  border: string
  /** small indicator dot */
  dot: string
  /** icon chip background for stat cards */
  iconChip: string
}

const S = {
  pending: {
    solid: "bg-status-pending text-white",
    soft: "bg-status-pending/12 text-status-pending",
    text: "text-status-pending",
    border: "border-status-pending/30",
    dot: "bg-status-pending",
    iconChip: "bg-status-pending/15 text-status-pending",
  },
  ongoing: {
    solid: "bg-status-ongoing text-white",
    soft: "bg-status-ongoing/12 text-status-ongoing",
    text: "text-status-ongoing",
    border: "border-status-ongoing/30",
    dot: "bg-status-ongoing",
    iconChip: "bg-status-ongoing/15 text-status-ongoing",
  },
  rework: {
    solid: "bg-status-rework text-white",
    soft: "bg-status-rework/12 text-status-rework",
    text: "text-status-rework",
    border: "border-status-rework/30",
    dot: "bg-status-rework",
    iconChip: "bg-status-rework/15 text-status-rework",
  },
  inspection: {
    solid: "bg-status-inspection text-white",
    soft: "bg-status-inspection/12 text-status-inspection",
    text: "text-status-inspection",
    border: "border-status-inspection/30",
    dot: "bg-status-inspection",
    iconChip: "bg-status-inspection/15 text-status-inspection",
  },
  release: {
    solid: "bg-status-release text-white",
    soft: "bg-status-release/12 text-status-release",
    text: "text-status-release",
    border: "border-status-release/30",
    dot: "bg-status-release",
    iconChip: "bg-status-release/15 text-status-release",
  },
  delayed: {
    solid: "bg-status-delayed text-white",
    soft: "bg-status-delayed/12 text-status-delayed",
    text: "text-status-delayed",
    border: "border-status-delayed/30",
    dot: "bg-status-delayed",
    iconChip: "bg-status-delayed/15 text-status-delayed",
  },
  concern: {
    solid: "bg-status-concern text-white",
    soft: "bg-status-concern/12 text-status-concern",
    text: "text-status-concern",
    border: "border-status-concern/30",
    dot: "bg-status-concern",
    iconChip: "bg-status-concern/15 text-status-concern",
  },
  onjob: {
    solid: "bg-status-onjob text-white",
    soft: "bg-status-onjob/12 text-status-onjob",
    text: "text-status-onjob",
    border: "border-status-onjob/30",
    dot: "bg-status-onjob",
    iconChip: "bg-status-onjob/15 text-status-onjob",
  },
  total: {
    solid: "bg-status-total text-white",
    soft: "bg-status-total/12 text-status-total",
    text: "text-status-total",
    border: "border-status-total/30",
    dot: "bg-status-total",
    iconChip: "bg-status-total/15 text-status-total",
  },
} as const

type ToneKey = keyof typeof S

function make(tone: ToneKey, label: string): StatusStyle {
  return { label, ...S[tone] }
}

/** Every label / db-key seen anywhere in the app, normalised to lowercase. */
const TABLE: Record<string, StatusStyle> = {
  pending: make("pending", "Pending"),
  ongoing: make("ongoing", "Ongoing"),
  "for rework": make("rework", "For Rework"),
  for_rework: make("rework", "For Rework"),
  "for inspection": make("inspection", "For Inspection"),
  for_inspection: make("inspection", "For Inspection"),
  "for release": make("release", "For Release"),
  for_release: make("release", "For Release"),
  released: make("release", "Released"),
  completed: make("inspection", "Completed"),
  "quality check": make("rework", "Quality Check"),
  quality_check: make("rework", "Quality Check"),
  delayed: make("delayed", "Delayed"),
  cancelled: make("total", "Cancelled"),

  in_progress: make("ongoing", "In Progress"),
  done: make("inspection", "Done"),

  resolved: make("inspection", "Resolved"),
  unresolved: make("delayed", "Unresolved"),

  open: make("pending", "Unrecorded"),
  recorded: make("ongoing", "Recorded"),

  // account rows
  active: make("inspection", "Active"),
  archived: make("total", "Archived"),

  available: make("inspection", "Available"),
  "on job": make("onjob", "On Job"),
  in_use: make("onjob", "In Use"),
  "not available": make("delayed", "Not Available"),
  unavailable: make("delayed", "Unavailable"),

  success: make("inspection", "Success"),
  error: make("delayed", "Error"),
  info: make("release", "Info"),
  warning: make("pending", "Warning"),
  concern: make("concern", "Concern"),
}

const FALLBACK = make("total", "—")

export function statusStyle(status: string | null | undefined): StatusStyle {
  if (!status) return FALLBACK
  return TABLE[status.toLowerCase().trim()] ?? FALLBACK
}

/** Inquiry "type" chips (Booking / Human Response / Report). */
export function inquiryTypeStyle(type: string): string {
  switch (type) {
    case "Booking":
      return "bg-status-ongoing/12 text-status-ongoing"
    case "Human Response":
      return "bg-status-concern/12 text-status-concern"
    case "Report":
      return "bg-status-warning/12 text-status-warning"
    default:
      return "bg-status-total/12 text-status-total"
  }
}
