"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, PackageCheck, ChevronDown, Users, RefreshCw, CheckCircle2, XCircle, Clock, RotateCcw, UserPlus, X, Loader2, Trash2 } from "lucide-react"
import { JobOrderDetailSkeleton } from "@/app/dashboard/job-management/[id]/loading"

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
  updated_est:            string | null
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
  const router = useRouter()

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

  // Stage rework modal
  const [reworkModal, setReworkModal] = useState<{ stageId: string; stageName: string } | null>(null)
  const [reworkNotes, setReworkNotes] = useState("")
  const [submittingRework, setSubmittingRework] = useState(false)
  const [reworkError, setReworkError] = useState<string | null>(null)

  // Cancel job
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling]       = useState(false)
  const [cancelError, setCancelError]     = useState<string | null>(null)

  // Substitute modal
  const [subModal, setSubModal]           = useState(false)
  const [subRole, setSubRole]             = useState<"detailer" | "installer">("detailer")
  const [subTechs, setSubTechs]           = useState<{ id: string; name: string; role: string; on_job: boolean; is_available: boolean }[]>([])
  const [subTechsLoading, setSubTechsLoading] = useState(false)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [addingSub, setAddingSub]         = useState(false)
  const [subError, setSubError]           = useState<string | null>(null)

  const updatedEst = job?.updated_est ?? null

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

  async function flagStageForRework() {
    if (!reworkModal || !reworkNotes.trim()) return
    setSubmittingRework(true)
    setReworkError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}/stage-rework`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ stage_id: reworkModal.stageId, rework_notes: reworkNotes.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to flag stage for rework")
      // Optimistically update the stage in local state
      setJob((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          stages: prev.stages.map((s) =>
            s.id === reworkModal.stageId
              ? { ...s, status: "for_rework", rework_instructions: reworkNotes.trim() }
              : s
          ),
        }
      })
      setReworkModal(null)
      setReworkNotes("")
    } catch (err: unknown) {
      setReworkError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmittingRework(false)
    }
  }

  async function openSubModal() {
    setSubModal(true)
    setSubRole("detailer")
    setSelectedSubId(null)
    setSubError(null)
    setSubTechsLoading(true)
    try {
      const res  = await fetch("/api/operations/job-management/list-technicians")
      const json = await res.json()
      setSubTechs((json.crew_members ?? []).map((t: any) => ({
        id:           t.id,
        name:         t.full_name,
        role:         t.role as string,
        on_job:       t.on_job       as boolean,
        is_available: t.is_available as boolean,
      })))
    } catch {
      setSubError("Failed to load technicians.")
    } finally {
      setSubTechsLoading(false)
    }
  }

  async function addSubstitute() {
    if (!selectedSubId) return
    setAddingSub(true)
    setSubError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}/add-substitute`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ technician_id: selectedSubId, role: subRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to add substitute")
      setSubModal(false)
      setSelectedSubId(null)
      await load()
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingSub(false)
    }
  }

  async function cancelJob() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to cancel job")
      router.push("/dashboard/job-management")
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : String(err))
      setCancelling(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <JobOrderDetailSkeleton />

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
          {/* Cancel — only when Pending */}
          {job.status === "Pending" && (
            <button
              type="button"
              onClick={() => setCancelConfirm(true)}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Cancel Job
            </button>
          )}
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
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            title="Refresh"
            className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {canRelease && (
            <button
              onClick={markReleased}
              disabled={releasing}
              className="flex items-center gap-2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              <PackageCheck className="w-4 h-4" />
              {releasing ? "Completing…" : "Mark as Completed"}
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
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Scheduled Start</p>
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
          {updatedEst && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Updated Est.</p>
              <p className="font-medium text-orange-600">{fmtDate(updatedEst)}</p>
            </div>
          )}
          <div className="col-span-2 md:col-span-4 pt-1">
            <button
              type="button"
              onClick={openSubModal}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Add Substitute Technician
            </button>
          </div>
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
                        <div className="flex items-center gap-2 flex-wrap justify-between">
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
                          {job.status === "For Inspection" && stage.status !== "for_rework" && (
                            <button
                              type="button"
                              onClick={() => { setReworkModal({ stageId: stage.id, stageName: stage.name }); setReworkNotes(""); setReworkError(null) }}
                              className="flex items-center gap-1 text-xs font-medium text-orange-600 border border-orange-300 bg-orange-50 hover:bg-orange-100 rounded-md px-2 py-1 transition-colors shrink-0"
                            >
                              <RotateCcw className="w-3 h-3" />
                              For Rework
                            </button>
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
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  STATUS_COLORS[h.status] ? "bg-current" : "bg-gray-300"
                }`} />
                <span className="font-medium text-gray-700 w-28 shrink-0">{h.status}</span>
                <span className="text-gray-400 text-xs">{fmtDate(h.created_at)}</span>
                <span className="text-gray-400 text-xs ml-auto">{h.changed_by}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-800">Cancel Job Order</h3>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Are you sure you want to cancel <span className="font-semibold text-gray-700">{job.customer_name}</span>?
            </p>
            <p className="text-xs text-red-500 mb-5">This cannot be undone. The job and all its records will be permanently deleted.</p>
            {cancelError && <p className="text-xs text-red-500 mb-3">{cancelError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCancelConfirm(false); setCancelError(null) }}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={cancelJob}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, Cancel Job"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Substitute Technician Modal */}
      {subModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800">Add Substitute Technician</h3>
              </div>
              <button type="button" title="Close" onClick={() => { setSubModal(false); setSubError(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">The substitute is added alongside the existing team — no one is removed.</p>

            {/* Role tabs */}
            <div className="flex gap-2 mb-4">
              {(["detailer", "installer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setSubRole(r); setSelectedSubId(null) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                    subRole === r
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Technician list */}
            <div className="max-h-52 overflow-y-auto space-y-1 mb-4">
              {subTechsLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
                </div>
              ) : subTechs.filter((t) => t.role === subRole && t.is_available && !t.on_job).length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No available technicians.</p>
              ) : (
                subTechs
                  .filter((t) => t.role === subRole && t.is_available && !t.on_job)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedSubId(t.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selectedSubId === t.id
                          ? "bg-blue-50 border-blue-300 text-blue-800"
                          : "bg-white border-gray-100 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                        t.on_job       ? "bg-orange-100 text-orange-600" :
                        t.is_available ? "bg-green-100 text-green-600"   :
                                         "bg-gray-100 text-gray-400"
                      }`}>
                        {t.on_job ? "On job" : t.is_available ? "Available" : "Unavailable"}
                      </span>
                    </button>
                  ))
              )}
            </div>

            {subError && <p className="text-xs text-red-500 mb-3">{subError}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSubModal(false); setSubError(null) }}
                disabled={addingSub}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addSubstitute}
                disabled={!selectedSubId || addingSub}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {addingSub ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Substitute"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage Rework Modal */}
      {reworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-800">Flag Stage for Rework</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Stage: <span className="font-medium text-gray-700">{reworkModal.stageName}</span>
            </p>
            <textarea
              value={reworkNotes}
              onChange={(e) => setReworkNotes(e.target.value)}
              placeholder="Describe what needs to be fixed…"
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
            {reworkError && (
              <p className="text-xs text-red-500 mt-2">{reworkError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setReworkModal(null); setReworkNotes(""); setReworkError(null) }}
                disabled={submittingRework}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={flagStageForRework}
                disabled={submittingRework || !reworkNotes.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {submittingRework ? "Flagging…" : "Flag for Rework"}
              </button>
            </div>
          </div>
        </div>
      )}

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
