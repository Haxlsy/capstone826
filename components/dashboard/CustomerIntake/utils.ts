import type { IntakeRecord, IntakeStatus } from "./types"

export const DB_STATUS_MAP: Record<string, IntakeStatus> = {
  pending: "Pending Job Order",
  job_created: "Job Created",
  cancelled: "Cancelled",
}

export function mapApiIntake(i: any): IntakeRecord {
  const year = new Date(i.created_at).getFullYear()
  return {
    id: `INT-${year}-${String(i.intake_id).padStart(3, "0")}`,
    intakeId: i.intake_id,
    customerName: i.customer?.full_name ?? "—",
    plate: i.plate_number ?? "—",
    vehicle: [i.make, i.model].filter(Boolean).join(" ") || "—",
    serviceType: i.service?.service_name ?? "—",
    scheduledDate: i.scheduled_date
      ? new Date(i.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—",
    rescheduled: false,
    paymentStatus: Number(i.balance) === 0 ? "Full Payment" : "DP Paid",
    dateSubmitted: new Date(i.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    status: DB_STATUS_MAP[i.status] ?? "Pending Job Order",
  }
}
