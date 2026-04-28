"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, PackageCheck, ChevronDown, Users, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react"

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
  category_id:         string | null
  category_name:       string | null
  category_color:      string | null
  status:              "pending" | "in_progress" | "done" | "for_rework"
  rework_instructions: string | null
  handoff_notes:       string | null
  completion_notes:    string | null
  completed_at:        string | null
  messenger_sent:      boolean | null
  messenger_sent_at:   string | null
  media:               StageMedia[]
  is_delayed:          boolean
  expected_end_at:     string | null
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

interface CrewMember {
  id:   string
  name: string
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
  detailers:              CrewMember[]
  installers:             CrewMember[]
  status:                 string
  scheduled_at:           string | null
  actual_start_at:        string | null
  expected_completion_at: string | null
  created_at:             string
  finishing_approved_at:  string | null
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
  "Pending":        "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Ongoing":        "bg-blue-50 text-blue-700 border-blue-200",
  "For Rework":     "bg-orange-50 text-orange-700 border-orange-200",
  "For Inspection": "bg-violet-50 text-violet-700 border-violet-200",
  "For Release":    "bg-green-50 text-green-700 border-green-200",
  "Released":       "bg-teal-50 text-teal-700 border-teal-200",
  "Delayed":        "bg-red-50 text-red-700 border-red-200",
  "Cancelled":      "bg-gray-50 text-gray-500 border-gray-200",
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

  // Release confirmation
  const [releasing, setReleasing] = useState(false)
  const [settingForRelease, setSettingForRelease] = useState(false)

  // Resend state: tracks which stage is currently being resent
  const [resendingId, setResendingId] = useState<string | null>(null)
  // Per-stage optimistic send status override after a resend attempt
  const [resendStatus, setResendStatus] = useState<Record<string, boolean | null>>({})

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

  async function setForRelease() {
    setSettingForRelease(true)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "For Release" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to set job for release")
      await load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSettingForRelease(false)
    }
  }

  async function resendStage(stageId: string) {
    setResendingId(stageId)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}/resend-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      })
      const json = await res.json()
      setResendStatus((prev) => ({ ...prev, [stageId]: res.ok ? true : false }))
      if (!res.ok) {
        // Keep the failed indicator — the API already persisted it
        console.warn("Resend failed:", json?.error)
      }
    } catch {
      setResendStatus((prev) => ({ ...prev, [stageId]: false }))
    } finally {
      setResendingId(null)
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

  // Group stages by category, preserving the order they first appear
  const categoryGroups = job.stages.reduce((acc, s) => {
    const key = s.category_id ?? `_${s.category_name}`
    if (!acc.has(key)) {
      acc.set(key, { name: s.category_name ?? "Unknown", color: s.category_color ?? "blue", stages: [] })
    }
    acc.get(key)!.stages.push(s)
    return acc
  }, new Map<string, { name: string; color: string; stages: Stage[] }>())

  // The last category by sequence order owns the "Passed to Operations" indicator.
  const lastStage = job.stages.length > 0
    ? job.stages.reduce((max, s) => (s.sequence_order ?? 0) > (max.sequence_order ?? 0) ? s : max, job.stages[0])
    : null
  const lastCategoryKey = lastStage
    ? (lastStage.category_id ?? `_${lastStage.category_name}`)
    : null

  const canRelease      = job.status === "For Release"
  // Show the "For Release" button whenever the job is awaiting operations sign-off.
  // It's enabled once the head detailer has passed finishing to ops (For Inspection),
  // or for jobs with no finishing stages that operations want to release directly.
  const showForReleased = !["For Release", "Released"].includes(job.status)
  const canForReleased  = job.status === "For Inspection" ||
    (Boolean(job.finishing_approved_at) && !["For Release", "Released"].includes(job.status))
  const displayId     = `JO-${new Date(job.created_at).getFullYear()}-${job.id.slice(-4).toUpperCase()}`

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
          {/* For Released — visible (but maybe disabled) when finishing stages exist and job not yet released */}
          {showForReleased && (
            <div className="relative group">
              <button
                onClick={canForReleased ? setForRelease : undefined}
                disabled={settingForRelease || !canForReleased}
                className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                  canForReleased
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    : "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                {settingForRelease ? "Processing…" : "For Release"}
              </button>
              {/* Tooltip when locked */}
              {!canForReleased && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 hidden group-hover:block">
                  Waiting for the Head Detailer to complete finishing stages and pass to Operations.
                  <div className="absolute -top-1.5 right-4 w-3 h-3 bg-gray-900 rotate-45" />
                </div>
              )}
            </div>
          )}
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
          <CrewCell label="Head Detailer" lead={job.head_detailer?.full_name ?? "Unassigned"} crew={job.detailers} />
          <CrewCell label="Head Installer" lead={job.head_installer?.full_name ?? "Unassigned"} crew={job.installers} />
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Started</p>
            <p className="font-medium text-gray-700">{fmtDate(job.actual_start_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Est. Completion</p>
            <p className="font-medium text-gray-700">{fmtDate(job.expected_completion_at)}</p>
          </div>
          {(() => {
            const lastExpected = job.stages
              .map((s) => s.expected_end_at)
              .filter(Boolean)
              .sort()
              .at(-1)
            if (!lastExpected || lastExpected === job.expected_completion_at) return null
            return (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Updated Est.</p>
                <p className="font-medium text-orange-600">{fmtDate(lastExpected)}</p>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Stage Progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Service Stage Progress</h2>

        {Array.from(categoryGroups.entries()).map(([key, group]) => {
          const isLastCategory = key === lastCategoryKey
          const extra = isLastCategory
            ? job.finishing_approved_at
              ? `Passed to Operations · ${fmtDate(job.finishing_approved_at)}`
              : "Awaiting handoff to Operations"
            : null
          return (
            <div key={key} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{group.name} stages</p>
                {extra && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    job.finishing_approved_at
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-600 border border-amber-200"
                  }`}>
                    {extra}
                  </span>
                )}
              </div>
                <div className="flex flex-col gap-2">
                  {group.stages.map((stage) => (
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
                        {stage.status === "done" ? "✓" : stage.sequence_order ?? "—"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{stage.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_STATUS_PILL[stage.status]}`}>
                            {stage.status.replace("_", " ")}
                          </span>
                          {stage.is_delayed && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Delayed
                            </span>
                          )}
                          {stage.completed_at && (
                            <span className="text-xs text-gray-400">{fmtDate(stage.completed_at)}</span>
                          )}
                        </div>
                        {stage.status !== "done" && stage.expected_end_at && (
                          <p className={`text-xs mt-0.5 ${stage.is_delayed ? "text-red-400" : "text-gray-400"}`}>
                            Expected by {fmtDate(stage.expected_end_at)}
                          </p>
                        )}

                        {/* Messenger send status indicator (done stages only) */}
                        {stage.status === "done" && (
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <SendIndicator
                              sent={resendStatus[stage.id] !== undefined ? resendStatus[stage.id] : stage.messenger_sent}
                              sentAt={stage.messenger_sent_at}
                            />
                            {/* Show Resend button when send failed or not yet attempted */}
                            {(resendStatus[stage.id] !== undefined ? resendStatus[stage.id] : stage.messenger_sent) !== true && (
                              <button
                                type="button"
                                title="Resend stage update to customer via Messenger"
                                onClick={() => resendStage(stage.id)}
                                disabled={resendingId === stage.id}
                                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50 transition-colors"
                              >
                                <RefreshCw
                                  className={`w-3 h-3 ${resendingId === stage.id ? "animate-spin" : ""}`}
                                />
                                {resendingId === stage.id ? "Resending…" : "Resend stage update"}
                              </button>
                            )}
                          </div>
                        )}

                        {stage.rework_instructions && (
                          <p className="text-xs text-orange-600 mt-1">
                            Rework: {stage.rework_instructions}
                          </p>
                        )}

                        {stage.completion_notes && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            Notes: {stage.completion_notes}
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
        })}
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

    </div>
  )
}

// ── SendIndicator ─────────────────────────────────────────────────────────────
// Shows whether the AI/Messenger stage update was sent to the customer.
//   null  → not yet attempted
//   true  → sent successfully
//   false → send failed

function SendIndicator({ sent, sentAt }: { sent: boolean | null; sentAt: string | null }) {
  if (sent === true) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" />
        Update sent{sentAt ? ` · ${fmtDate(sentAt)}` : ""}
      </span>
    )
  }
  if (sent === false) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="w-3 h-3" />
        Update failed{sentAt ? ` · ${fmtDate(sentAt)}` : ""}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
      <Clock className="w-3 h-3" />
      Update not sent
    </span>
  )
}

// ── CrewCell ──────────────────────────────────────────────────────────────────
// Shows lead name + collapsible crew list (collapsed when ≥ 2 members).

function CrewCell({ label, lead, crew }: { label: string; lead: string; crew: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const collapsible = crew.length >= 2

  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="font-medium text-gray-700">{lead}</p>
      {crew.length > 0 && (
        <div className="mt-1">
          {collapsible ? (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Users size={11} />
                {crew.length} crew members
                <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <ul className="mt-1 space-y-0.5 pl-1">
                  {crew.map((m) => (
                    <li key={m.id} className="text-xs text-gray-600">{m.name}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <ul className="space-y-0.5 pl-1">
              {crew.map((m) => (
                <li key={m.id} className="text-xs text-gray-500 flex items-center gap-1">
                  <Users size={10} className="text-gray-300" />
                  {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
