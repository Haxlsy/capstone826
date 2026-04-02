import { RefreshCw } from "lucide-react"
import type { IntakeRecord, IntakeStatus, PaymentStatus } from "../types"
import ActionsMenu from "./ActionsMenu"

const statusBadge: Record<IntakeStatus, string> = {
  "Pending Job Order": "bg-yellow-100 text-yellow-700",
  "Job Created":       "bg-green-100 text-green-600",
  "Cancelled":         "bg-gray-100 text-gray-400",
}

const paymentBadge: Record<PaymentStatus, string> = {
  "DP Paid":      "bg-blue-100 text-blue-500",
  "Full Payment": "bg-green-100 text-green-600",
}

interface Props {
  records: IntakeRecord[]
  loading: boolean
  onCancel: (id: string) => void
}

export default function IntakeTable({ records, loading, onCancel }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-b-2xl rounded-tr-2xl p-4 overflow-y-auto max-h-[60vh]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {["INTAKE ID", "CUSTOMER NAME", "VEHICLE", "SERVICE TYPE", "SCHEDULED DATE", "PAYMENT STATUS", "DATE SUBMITTED", "STATUS", ""].map((col) => (
              <th key={col} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={9} className="text-center py-10 text-sm text-gray-400">Loading...</td>
            </tr>
          ) : records.map((r) => {
            const cancelled = r.status === "Cancelled"
            const dim = cancelled ? "text-gray-400" : "text-gray-700"
            return (
              <tr key={r.id} className={`border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${cancelled ? "opacity-60" : ""}`}>
                <td className={`px-4 py-3.5 font-mono text-xs ${cancelled ? "text-gray-400" : "text-blue-500"}`}>{r.id}</td>
                <td className={`px-4 py-3.5 font-semibold ${dim}`}>{r.customerName}</td>
                <td className={`px-4 py-3.5 ${dim}`}>{r.plate} — {r.vehicle}</td>
                <td className={`px-4 py-3.5 ${dim}`}>{r.serviceType}</td>
                <td className={`px-4 py-3.5 ${dim}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{r.scheduledDate}</span>
                    {r.rescheduled && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                        <RefreshCw className="w-2.5 h-2.5" />
                        Rescheduled
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cancelled ? "bg-gray-100 text-gray-400" : paymentBadge[r.paymentStatus]}`}>
                    {r.paymentStatus}
                  </span>
                </td>
                <td className={`px-4 py-3.5 ${dim}`}>{r.dateSubmitted}</td>
                <td className="px-4 py-3.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <ActionsMenu record={r} onCancel={onCancel} />
                </td>
              </tr>
            )
          })}
          {!loading && records.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center py-10 text-sm text-gray-400">No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
