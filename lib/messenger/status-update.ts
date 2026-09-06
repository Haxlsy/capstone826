import { createAdminClient } from "@/lib/supabase/admin"

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
 * Reads the shop's operating hours straight from the admin-managed knowledge
 * base (`chatbot_knowledge`, category "Hours") so the release message always
 * reflects whatever an admin last configured, with no hardcoded time to drift
 * out of sync. Returns null (not a guess) if that entry doesn't exist.
 */
export async function getOperatingHoursText(): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("chatbot_knowledge")
      .select("content")
      .ilike("category", "hours")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    return clean(data?.content as string | undefined)
  } catch (err) {
    console.error("[status-update] operating hours lookup failed:", err)
    return null
  }
}
