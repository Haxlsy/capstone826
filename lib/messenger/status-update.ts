import { createAdminClient } from "@/lib/supabase/admin"
import {
  formatOperatingHours,
  DEFAULT_OPERATING_DAYS,
  DEFAULT_OPERATING_OPEN_TIME,
  DEFAULT_OPERATING_CLOSE_TIME,
  type Weekday,
} from "@/types/chatbot"

/**
 * Builds the customer-facing Messenger messages sent when a job order's
 * overall status moves to "For Release" (ready for pickup) or "Released"
 * (picked up — the job is done). Pure — no DB, no network — same shape as
 * `buildStageUpdateMessage` in `stage-update.ts`, so both the auto-send call
 * site and any future manual "resend" button share one source of truth.
 */

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim()
  return t && t !== "—" ? t : null
}

function vehicleClause(vehicleUnit: string | null | undefined, plate: string | null | undefined): string {
  const vehicle = clean(vehicleUnit)
  const plateNo = clean(plate)
  if (vehicle && plateNo) return `your ${vehicle} (plate ${plateNo})`
  if (vehicle) return `your ${vehicle}`
  if (plateNo) return `your vehicle (plate ${plateNo})`
  return "your vehicle"
}

export interface ReleaseMessageInput {
  customerName: string | null | undefined
  vehicleUnit: string | null | undefined
  plate: string | null | undefined
  /** Live text from the "Hours" knowledge base entry — null if it's missing/deleted. */
  operatingHours: string | null | undefined
}

export function buildReleaseMessage(i: ReleaseMessageInput): string {
  const name = clean(i.customerName) ?? "there"
  const hours = clean(i.operatingHours)

  const lines = [
    `🚗 Good news, ${name}!`,
    "",
    `${vehicleClause(i.vehicleUnit, i.plate)} is now ready for release.`,
  ]

  // Only state a specific time if the knowledge base actually has one —
  // never fabricate hours if that entry is missing or deleted.
  if (hours) {
    lines.push("", `You may pick it up during our operating hours: ${hours}`)
  } else {
    lines.push("", "You may pick it up during our regular operating hours.")
  }

  lines.push("", "See you soon!")

  return lines.join("\n")
}

export interface CompletionMessageInput {
  customerName: string | null | undefined
  vehicleUnit: string | null | undefined
  plate: string | null | undefined
}

export function buildCompletionMessage(i: CompletionMessageInput): string {
  const name = clean(i.customerName) ?? "there"

  return [
    `🙏 Thank you, ${name}!`,
    "",
    `We hope you're happy with the work done on ${vehicleClause(i.vehicleUnit, i.plate)}.`,
    "",
    "Thanks for trusting 826 Auto Aesthetic & Protection — we'd love to serve you again!",
  ].join("\n")
}

/**
 * Reads the shop's structured Operating Hours setting (`chatbot_config.settings`)
 * so the release message always reflects whatever an admin last configured —
 * same source of truth the AI chatbot uses (see formatOperatingHours in
 * types/chatbot.ts), just no hardcoded/free-text hours to drift out of sync.
 * Falls back to the documented defaults (not null) on any read failure, since
 * "some hours" beats silently dropping the line — this mirrors the fail-open
 * philosophy used elsewhere (e.g. isMediaValidationEnabled).
 */
export async function getOperatingHoursText(): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("chatbot_config")
      .select("settings")
      .limit(1)
      .single()

    const settings = (data?.settings ?? {}) as {
      operating_days?: Weekday[]
      operating_open_time?: string
      operating_close_time?: string
      operating_closed_on_holidays?: boolean
    }

    return formatOperatingHours({
      operating_days: settings.operating_days ?? DEFAULT_OPERATING_DAYS,
      operating_open_time: settings.operating_open_time ?? DEFAULT_OPERATING_OPEN_TIME,
      operating_close_time: settings.operating_close_time ?? DEFAULT_OPERATING_CLOSE_TIME,
      operating_closed_on_holidays: settings.operating_closed_on_holidays ?? true,
    })
  } catch (err) {
    console.error("[status-update] operating hours lookup failed:", err)
    return null
  }
}
