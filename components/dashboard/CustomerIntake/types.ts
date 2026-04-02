export type IntakeStatus = "Pending Job Order" | "Job Created" | "Cancelled"
export type PaymentStatus = "DP Paid" | "Full Payment"
export type TabFilter = "All" | IntakeStatus

export interface IntakeRecord {
  id: string
  intakeId?: number
  customerName: string
  plate: string
  vehicle: string
  serviceType: string
  scheduledDate: string
  rescheduled: boolean
  paymentStatus: PaymentStatus
  dateSubmitted: string
  status: IntakeStatus
}
