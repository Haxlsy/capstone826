/**
 * Builds the customer-facing Messenger message sent when a service stage is
 * marked done. Shared by the head-technician auto-send and the operations
 * "Resend stage update" button so the two never drift.
 *
 * Pure — no DB, no network. Every field except `customerName` and `stageName`
 * is optional/nullable; a missing field drops its clause rather than printing
 * a placeholder.
 */
export interface StageUpdateInput {
  customerName: string
  stageName: string
  categoryName: string | null | undefined
  serviceName: string | null | undefined
  vehicleUnit: string | null | undefined
  plate: string | null | undefined
  /** Stages completed for the job so far, including this one. */
  completedCount?: number | null
  /** Total stages on the job. */
  totalCount?: number | null
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim()
  return t && t !== "—" ? t : null
}

/** "preparation" → "Preparation"; leaves already-capitalised names untouched. */
const titleCase = (s: string): string =>
  s.replace(/\b\p{Ll}/gu, (c) => c.toUpperCase())

export function buildStageUpdateMessage(i: StageUpdateInput): string {
  const vehicle = clean(i.vehicleUnit)
  const plate = clean(i.plate)
  const category = clean(i.categoryName)
  const service = clean(i.serviceName)
  const stage = clean(i.stageName) ?? "a service step"
  const name = clean(i.customerName) ?? "there"

  // Header
  let header = "✅ Service update"
  if (vehicle && plate) header += ` for your ${vehicle} (plate ${plate})`
  else if (vehicle) header += ` for your ${vehicle}`
  else if (plate) header += ` for plate ${plate}`
  else header += " for your vehicle"

  // Body
  let body = `We've completed "${stage}"`
  if (category) body += ` in the ${titleCase(category)} stage`
  if (service) body += ` of your ${service} service`
  body += "."

  const lines = [header, "", body]

  // Progress
  const done = i.completedCount
  const total = i.totalCount
  if (typeof done === "number" && typeof total === "number" && total > 0) {
    lines.push("", `Progress: ${done} of ${total} steps done.`)
  }

  lines.push(
    "",
    `Thanks for your patience, ${name} - we'll message you again as each step is finished.`
  )

  return lines.join("\n")
}
