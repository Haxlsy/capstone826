"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import type { StatusOption } from "./StatusPickerModal"

const MAX_REASON = 300

interface Props {
  customerName: string
  target:       StatusOption
  error:        string | null
  updating:     boolean
  onConfirm:    (reason: string) => void
  onBack:       () => void
  count?:       number
}

export default function StatusConfirmDialog({ customerName, target, error, updating, onConfirm, onBack, count }: Props) {
  const [reason, setReason] = useState("")
  const isBulk  = count !== undefined && count > 1
  const subject = isBulk ? `${count} selected jobs` : customerName

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={() => !updating && onBack()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4 text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${target.iconBg}`}>
            <span className={target.text}>{target.icon}</span>
          </div>

          <h2 className="text-base font-bold text-gray-800">Confirm Status Change</h2>
          <p className="text-sm text-gray-500 mt-1.5">
            Update <span className="font-semibold text-gray-700">{subject}</span> to
          </p>

          <span className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-semibold ring-1 ${target.ring} ${target.iconBg} ${target.text}`}>
            {target.icon}
            {target.label}
          </span>
        </div>

        {/* Reason */}
        <div className="px-5 pb-3">
          <label className="text-xs font-medium text-gray-600">
            Reason <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
            rows={3}
            placeholder="Describe the reason for this status change…"
            className="mt-1.5 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-gray-400 text-right mt-0.5">{reason.length}/{MAX_REASON}</p>
        </div>

        {error && (
          <p className="mx-5 mb-3 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onBack}
            disabled={updating}
            className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={updating}
            className={`flex-1 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 ${
              target.db === "Delayed" ? "bg-red-500 hover:bg-red-600" : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {updating ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}
