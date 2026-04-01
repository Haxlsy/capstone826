"use client"

import { useState } from "react"
import { X, CheckCircle } from "lucide-react"

type ConcernStatus = "Unresolved" | "Resolved"
type ConcernType = "Material Issue" | "Equipment" | "Rework Needed"

export interface ConcernRecordFull {
  jobId: string
  techInitials: string
  techName: string
  techColor: string
  concernType: ConcernType
  description: string
  attachments: number
  submitted: string
  status: ConcernStatus
}

interface ConcernDetailsDrawerProps {
  record: ConcernRecordFull | null
  onClose: () => void
  onResolve: (jobId: string, note: string) => void
}

const concernTypeBadgeMap: Record<ConcernType, string> = {
  "Material Issue": "bg-red-100 text-red-600",
  Equipment: "bg-orange-100 text-orange-600",
  "Rework Needed": "bg-purple-100 text-purple-600",
}

export default function ConcernDetailsDrawer({ record, onClose, onResolve }: ConcernDetailsDrawerProps) {
  const [responseNote, setResponseNote] = useState("")
  const isOpen = record !== null

  function handleResolve() {
    if (!record) return
    onResolve(record.jobId, responseNote)
    setResponseNote("")
  }

  // Reset note when a new record is opened
  const isResolved = record?.status === "Resolved"

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
          <h2 className="text-base font-bold text-gray-800">Concern Details</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        {record && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Job Order ID + Technician */}
              <div className="grid grid-cols-2 gap-x-6">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Job Order ID</p>
                  <p className="text-sm font-semibold text-gray-800">{record.jobId}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Technician</p>
                  <p className="text-sm font-semibold text-gray-800">{record.techName}</p>
                </div>
              </div>

              {/* Concern Type + Submitted */}
              <div className="grid grid-cols-2 gap-x-6">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Concern Type</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${concernTypeBadgeMap[record.concernType]}`}>
                    {record.concernType}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                  <p className="text-sm text-gray-800">{record.submitted}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{record.description}</p>
              </div>

              {/* Attachments */}
              {record.attachments > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Attachments</p>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: record.attachments }).map((_, i) => (
                      <div
                        key={i}
                        className="w-16 h-16 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center"
                      >
                        <div className="w-6 h-6 rounded bg-gray-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Note */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Response Note</p>
                {isResolved ? (
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 min-h-[90px]">
                    {record.description.replace("...", " — concern has been reviewed and resolved.")}
                  </div>
                ) : (
                  <textarea
                    value={responseNote}
                    onChange={(e) => setResponseNote(e.target.value)}
                    placeholder="Add notes for this concern..."
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  />
                )}
              </div>
            </div>

            {/* Footer button */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {isResolved ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Resolved
                </div>
              ) : (
                <button
                  onClick={handleResolve}
                  className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
                >
                  Mark as Resolved
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
