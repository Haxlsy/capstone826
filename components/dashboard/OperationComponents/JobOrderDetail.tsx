"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, PackageCheck, XCircle, ChevronDown,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageMedia {
  id:         string
  file_url:   string
  media_type: "photo" | "video"
}

interface Stage {
  id:                  string
  name:                string
  sequence_order:      number
  category:            "preparation" | "installation"
  status:              "pending" | "in_progress" | "done" | "for_rework"
  rework_instructions: string | null
  handoff_notes:       string | null
  completed_at:        string | null
  media:               StageMedia[]
}

interface HistoryEntry {
  status:     string
  created_at: string
  changed_by: string
}

interface TeamMember {
  id:        string
  full_name: string
}

interface JobDetail {
  id:                     string
  customer_name:          string
  plate_number:           string
  vehicle_unit:           string
  contact_number:         string
  service:                string
  head_detailer:          TeamMember | null
  head_installer:         TeamMember | null
  status:                 string
  scheduled_at:           string | null
  actual_start_at:        string | null
  expected_completion_at: string | null
  created_at:             string
  history:                HistoryEntry[]
  stages:                 Stage[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

const STATUS_COLORS: Record<string, string> = {
  "Pending":     "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Ongoing":     "bg-blue-50 text-blue-700 border-blue-200",
  "For Rework":  "bg-orange-50 text-orange-700 border-orange-200",
  "For Release": "bg-purple-50 text-purple-700 border-purple-200",
  "Released":    "bg-green-50 text-green-700 border-green-200",
  "Delayed":     "bg-red-50 text-red-700 border-red-200",
  "Cancelled":   "bg-gray-50 text-gray-500 border-gray-200",
}

const STAGE_STATUS_PILL: Record<string, string> = {
  pending:    "bg-gray-100 text-gray-500",
  in_progress:"bg-blue-100 text-blue-700",
  done:       "bg-green-100 text-green-700",
  for_rework: "bg-orange-100 text-orange-700",
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobOrderDetail({ jobId }: { jobId: string }) {
  const [job, setJob]             = useState<JobDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Rework modal state
  const [reworkOpen, setReworkOpen]         = useState(false)
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set())
  const [reworkNote, setReworkNote]         = useState("")
  const [submitting, setSubmitting]         = useState(false)
  const [reworkError, setReworkError]       = useState<string | null>(null)

  // Release confirmation
  const [releasing, setReleasing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load job order")
      setJob(json.job)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { load() }, [load])

  function toggleStage(stageId: string) {
    setSelectedStages((prev) => {
      const next = new Set(prev)
      next.has(stageId) ? next.delete(stageId) : next.add(stageId)
      return next
    })
  }

  async function submitRework() {
    if (!selectedStages.size || !reworkNote.trim()) return
    setSubmitting(true)
    setReworkError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}/rework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_ids:           [...selectedStages],
          rework_instructions: reworkNote.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to flag rework")
      setReworkOpen(false)
      setSelectedStages(new Set())
      setReworkNote("")
      await load()
    } catch (err: unknown) {
      setReworkError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function markReleased() {
    setReleasing(true)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Released" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to release job")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReleasing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-sm text-gray-400">
      Loading job details…
    </div>
  )

  if (error || !job) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-sm text-red-500">{error ?? "Job not found."}</p>
      <Link href="/dashboard/job-management" className="text-sm text-blue-600 hover:underline">
        ← Back to Job Management
      </Link>
    </div>
  )

  const prepStages  = job.stages.filter((s) => s.category === "preparation")
  const instStages  = job.stages.filter((s) => s.category === "installation")
  const canRelease  = job.status === "For Release"
  const canRework   = ["Ongoing", "For Rework"].includes(job.status)
  const displayId   = `JO-${new Date(job.created_at).getFullYear()}-${job.id.slice(-4).toUpperCase()}`

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/job-management"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Job Management
        </Link>
        <div className="flex items-center gap-3">
          {canRelease && (
            <button
              onClick={markReleased}
              disabled={releasing}
              className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              {releasing ? "Releasing…" : "Mark as Released"}
            </button>
          )}
          {canRework && (
            <button
              onClick={() => setReworkOpen(true)}
              className="flex items-center gap-2 bg-orange-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Flag for Rework
            </button>
          )}
        </div>
      </div>

      {/* Job Info Card */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">{displayId}</p>
            <h1 className="text-xl font-bold text-gray-800">{job.customer_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{job.contact_number}</p>
          </div>
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-600"}`}>
            {job.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Vehicle</p>
            <p className="font-medium text-gray-700">{job.vehicle_unit}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Plate</p>
            <p className="font-medium text-blue-600">{job.plate_number}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Service</p>
            <p className="font-medium text-gray-700">{job.service}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Scheduled</p>
            <p className="font-medium text-gray-700">{fmtDate(job.scheduled_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Head Detailer</p>
            <p className="font-medium text-gray-700">{job.head_detailer?.full_name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Head Installer</p>
            <p className="font-medium text-gray-700">{job.head_installer?.full_name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Started</p>
            <p className="font-medium text-gray-700">{fmtDate(job.actual_start_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Est. Completion</p>
            <p className="font-medium text-gray-700">{fmtDate(job.expected_completion_at)}</p>
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Service Stage Progress</h2>

        {[{ label: "Preparation Stages", stages: prepStages }, { label: "Installation Stages", stages: instStages }].map(
          ({ label, stages }) =>
            stages.length === 0 ? null : (
              <div key={label} className="mb-6 last:mb-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{label}</p>
                <div className="flex flex-col gap-2">
                  {stages.map((stage, idx) => (
                    <div
                      key={stage.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        stage.status === "for_rework"
                          ? "border-orange-200 bg-orange-50/50"
                          : "border-gray-100 bg-gray-50/50"
                      }`}
                    >
                      {/* Stage number */}
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                        stage.status === "done" ? "bg-green-500 text-white" :
                        stage.status === "for_rework" ? "bg-orange-400 text-white" :
                        "bg-gray-200 text-gray-500"
                      }`}>
                        {stage.status === "done" ? "✓" : idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{stage.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_STATUS_PILL[stage.status]}`}>
                            {stage.status.replace("_", " ")}
                          </span>
                          {stage.completed_at && (
                            <span className="text-xs text-gray-400">{fmtDate(stage.completed_at)}</span>
                          )}
                        </div>

                        {stage.rework_instructions && (
                          <p className="text-xs text-orange-600 mt-1">
                            Rework: {stage.rework_instructions}
                          </p>
                        )}

                        {/* Media */}
                        {stage.media.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {stage.media.map((m) =>
                              m.media_type === "photo" ? (
                                <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={m.file_url}
                                    alt="stage media"
                                    className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
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
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>

      {/* Status History */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Status History</h2>
        <div className="flex flex-col gap-2">
          {job.history.length === 0 ? (
            <p className="text-sm text-gray-400">No history recorded.</p>
          ) : (
            job.history.map((h, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  STATUS_COLORS[h.status] ? "bg-current" : "bg-gray-300"
                }`} />
                <span className="font-medium text-gray-700 w-28 flex-shrink-0">{h.status}</span>
                <span className="text-gray-400 text-xs">{fmtDate(h.created_at)}</span>
                <span className="text-gray-400 text-xs ml-auto">{h.changed_by}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rework Modal */}
      {reworkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="text-base font-semibold text-gray-800">Flag Stages for Rework</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Select the stages that need to be redone and provide instructions for the technician.
            </p>

            {/* Stage selector */}
            <div className="flex flex-col gap-2 mb-4 max-h-48 overflow-y-auto">
              {job.stages
                .filter((s) => s.status === "done" || s.status === "for_rework")
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStages.has(s.id)}
                      onChange={() => toggleStage(s.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{s.name}</span>
                    <span className="text-xs text-gray-400 capitalize ml-auto">{s.category}</span>
                  </label>
                ))}
              {job.stages.filter((s) => s.status === "done" || s.status === "for_rework").length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No completed stages to flag.</p>
              )}
            </div>

            {/* Instructions */}
            <textarea
              value={reworkNote}
              onChange={(e) => setReworkNote(e.target.value)}
              placeholder="Describe what needs to be redone…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3 resize-none"
            />

            {reworkError && (
              <p className="text-xs text-red-500 mb-3">{reworkError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setReworkOpen(false); setSelectedStages(new Set()); setReworkNote("") }}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRework}
                disabled={submitting || !selectedStages.size || !reworkNote.trim()}
                className="flex-1 py-2 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Flagging…" : "Flag for Rework"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
