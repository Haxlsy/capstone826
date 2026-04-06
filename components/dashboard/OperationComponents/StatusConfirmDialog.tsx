"use client"

import { Loader2 } from "lucide-react"
import type { StatusOption } from "./StatusPickerModal"

interface Props {
  customerName: string
  target: StatusOption
  error: string | null
  updating: boolean
  onConfirm: () => void
  onBack: () => void
  count?: number // when bulk updating multiple jobs
}

export default function StatusConfirmDialog({ customerName, target, error, updating, onConfirm, onBack, count }: Props) {
  const isBulk = count !== undefined && count > 1
  const subject = isBulk ? `${count} selected jobs` : customerName
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => !updating && onBack()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center">
          {/* Status icon */}
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${target.iconBg}`}>
            <span className={target.text}>{target.icon}</span>
          </div>

          <h2 className="text-base font-bold text-gray-800">Confirm Status Change</h2>
          <p className="text-sm text-gray-500 mt-1.5">
            Update <span className="font-semibold text-gray-700">{subject}</span> to
          </p>

          <span
            className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-semibold ring-1 ${target.ring} ${target.iconBg} ${target.text}`}
          >
            {target.icon}
            {target.label}
          </span>

          {error && (
            <p className="mt-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onBack}
            disabled={updating}
            className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={updating}
            className={`flex-1 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 ${
              target.db === "cancelled" ? "bg-gray-700 hover:bg-gray-800" :
              target.db === "delayed"   ? "bg-red-500 hover:bg-red-600" :
              "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {updating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
