"use client"

import { X } from "lucide-react"

type IntakeStatus = "Pending Job Order" | "Job Created" | "Cancelled"
type PaymentType = "DP Paid" | "Full Payment"

export interface IntakeRecordFull {
  id: string
  customer: string
  contact: string
  email: string
  address: string
  plate: string
  vehicle: string
  color: string
  service: string
  bookingDate: string
  payment: PaymentType
  paymentMethod: string
  downpayment: string
  remainingBalance: string
  submitted: string
  status: IntakeStatus
  rescheduleHistory?: {
    prevDate: string
    newDate: string
    reason: string
    changed: string
  }[]
}

interface IntakeRecordDrawerProps {
  record: IntakeRecordFull | null
  onClose: () => void
}

const statusBadgeMap: Record<IntakeStatus, string> = {
  "Pending Job Order": "bg-amber-100 text-amber-700",
  "Job Created": "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-500",
}

const paymentBadgeMap: Record<PaymentType, string> = {
  "DP Paid": "bg-blue-100 text-blue-700",
  "Full Payment": "bg-green-100 text-green-700",
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {label}
    </p>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  )
}

function Divider() {
  return <hr className="border-gray-100 my-4" />
}

export default function IntakeRecordDrawer({ record, onClose }: IntakeRecordDrawerProps) {
  const isOpen = record !== null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">Intake Record Details</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        {record && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">

            {/* Status */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeMap[record.status]}`}>
                {record.status}
              </span>
            </div>

            <Divider />

            {/* Customer Information */}
            <SectionHeader label="Customer Information" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Customer Name" value={record.customer} />
              <Field label="Contact Number" value={record.contact} />
              <Field label="Email" value={record.email} />
              <Field label="Home Address" value={record.address} />
            </div>

            <Divider />

            {/* Vehicle Information */}
            <SectionHeader label="Vehicle Information" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Plate No." value={record.plate} />
              <Field label="Make / Model" value={record.vehicle} />
              <Field label="Color" value={record.color} />
              <Field label="Service Type" value={record.service} />
            </div>

            <Divider />

            {/* Booking & Payment */}
            <SectionHeader label="Booking & Payment" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Scheduled Booking Date" value={record.bookingDate} />
              <Field label="Payment Method" value={record.paymentMethod} />
              <Field label="Downpayment Amount" value={record.downpayment} />
              <Field label="Remaining Balance" value={record.remainingBalance} />
              <Field
                label="Payment Status"
                value={
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadgeMap[record.payment]}`}>
                    {record.payment}
                  </span>
                }
              />
              <Field label="Date Submitted" value={record.submitted} />
            </div>

            {/* Reschedule History */}
            {record.rescheduleHistory && record.rescheduleHistory.length > 0 && (
              <>
                <Divider />
                <SectionHeader label="Reschedule History" />
                <div className="space-y-4">
                  {record.rescheduleHistory.map((entry, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-6">
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Previous Date</p>
                          <p className="text-sm text-gray-400 font-medium line-through">{entry.prevDate}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">New Date</p>
                          <p className="text-sm text-gray-800 font-medium">{entry.newDate}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Reason</p>
                        <p className="text-sm text-gray-700">{entry.reason}</p>
                      </div>
                      <p className="text-xs text-gray-400">Changed: {entry.changed}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
