"use client"

import { useState } from "react"
import { X, CheckCircle, Paperclip } from "lucide-react"

export interface ConcernRecord {
  id:            string
  title:         string
  description:   string
  status:        "Pending" | "Resolved"
  response_note: string | null
  submitted_at:  string
  jobId:         string       // display ID
  submitterName: string
  submitterRole: string
  media:         { id: string; file_url: string; media_type: string }[]
}

interface ConcernDetailsDrawerProps {
  record:    ConcernRecord | null
  onClose:   () => void
  onResolve: (id: string, note: string) => void
}

export default function ConcernDetailsDrawer({ record, onClose, onResolve }: ConcernDetailsDrawerProps) {
  const [responseNote, setResponseNote] = useState("")
  const [resolving, setResolving]       = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const isOpen     = record !== null
  const isResolved = record?.status === "Resolved"

  async function handleResolve() {
    if (!record) return
    setResolving(true)
    setResolveError(null)
    try {
      const res  = await fetch(`/api/operations/job-concerns/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved", response_note: responseNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to resolve concern")
      onResolve(record.id, responseNote)
      setResponseNote("")
    } catch (err: unknown) {
      setResolveError(err instanceof Error ? err.message : String(err))
    } finally {
      setResolving(false)
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        className={`fixed top-0 right-0 h-full w-105 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">Concern Details</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {record && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Submitted By</p>
                <p className="text-sm font-semibold text-gray-800">{record.submitterName}</p>
                <p className="text-xs text-gray-400 capitalize">{record.submitterRole.replace("_", " ")}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                <p className="text-sm text-gray-700">{record.submitted_at}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Title</p>
                <p className="text-sm font-semibold text-gray-800">{record.title}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">{record.description}</p>
              </div>

              {record.media.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Attachments ({record.media.length})
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {record.media.map((m) =>
                      m.media_type === "photo" ? (
                        <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={m.file_url}
                            alt="concern attachment"
                            className="w-16 h-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          key={m.id}
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          ▶ Video
                        </a>
                      )
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400 mb-1.5">Response Note</p>
                {isResolved ? (
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 bg-gray-50 min-h-[22.5]">
                    {record.response_note ?? "—"}
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

              {resolveError && <p className="text-xs text-red-500">{resolveError}</p>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0">
              {isResolved ? (
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-600 text-sm font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Resolved
                </div>
              ) : (
                <button
                  onClick={handleResolve}
                  disabled={resolving}
                  className="w-full py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {resolving ? "Resolving…" : "Mark as Resolved"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
