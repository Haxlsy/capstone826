"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, PackageCheck, ChevronDown, Users, RefreshCw, CheckCircle2, XCircle,
  Clock, RotateCcw, UserPlus, Loader2, Trash2, FileText, Pencil, X,
} from "lucide-react"
import { JobOrderDetailSkeleton } from "@/app/dashboard/job-management/[id]/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button, IconButton } from "@/components/ui/Button"
import { Card, CardBody } from "@/components/ui/Card"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { StatusBadge, Badge } from "@/components/ui/Badge"
import { Textarea, Input } from "@/components/ui/Field"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/components/ui/Toast"
import { substituteRoleLabel } from "@/lib/substitute-label"
import { formatOperatingHours, isWithinOperatingHours, DEFAULT_OPERATING_DAYS, DEFAULT_OPERATING_OPEN_TIME, DEFAULT_OPERATING_CLOSE_TIME, type Weekday } from "@/types/chatbot"
import { alreadyOnJob } from "@/lib/operations/team-membership"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import { displayJobStatus } from "@/lib/job-delay"
import { isTechnicianAvailableToday } from "@/lib/technician-availability"
import { categorySwatch } from "@/lib/ui/category-colors"
import { fmtDateTime } from "@/lib/time-display"
import { useOfflineLock, OfflinePausedNote, OFFLINE_ACTION_HINT } from "@/hooks/useOfflineLock"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageMedia {
  id: string
  file_url: string
  media_type: "photo" | "video"
  rework_round?: number
}

interface Stage {
  id: string
  name: string
  sequence_order: number
  category_id: string | null
  category_name: string | null
  category_color: string | null
  status: "pending" | "in_progress" | "done" | "for_rework"
  rework_instructions: string | null
  handoff_notes: string | null
  completion_notes: string | null
  completed_at: string | null
  messenger_sent: boolean | null
  messenger_sent_at: string | null
  /** Round 0 — the original, customer-facing upload. */
  media: StageMedia[]
  /** Round 1+ — every rework resubmission, operations-only, never sent to
   *  the customer. Each item keeps its own rework_round for labeling. */
  rework_media: StageMedia[]
  /** One entry per rework round the technician confirmed, in ascending
   *  round order. Round 0's note is completion_notes above, unaffected. */
  rework_notes: { round: number; notes: string; created_at: string }[]
  current_rework_round: number
  is_delayed: boolean
  expected_end_at: string | null
}

interface HistoryEntry {
  status: string
  created_at: string
  changed_by: string
}

interface TeamMember {
  id: string
  full_name: string
}

interface CrewMember {
  id: string
  name: string
  is_substitute: boolean
}

interface JobDetail {
  id: string
  job_order_code: string
  customer_name: string
  plate_number: string
  vehicle_unit: string
  contact_number: string
  email: string | null
  service: string
  head_detailer: TeamMember | null
  head_installer: TeamMember | null
  head_detailer_substitutes: TeamMember[]
  head_installer_substitutes: TeamMember[]
  detailers: CrewMember[]
  installers: CrewMember[]
  status: string
  is_overdue: boolean
  scheduled_at: string | null
  actual_start_at: string | null
  expected_completion_at: string | null
  // Lets the client preview a new Est. Completion (via the shared
  // estimate-completion endpoint) while editing Scheduled Start, without
  // re-implementing working-hours math in the browser.
  total_duration_mins: number
  updated_est: string | null
  created_at: string
  finishing_approved_at: string | null
  history: HistoryEntry[]
  stages: Stage[]
}

// Collapsed by default — a stage reworked more than once otherwise pushes a
// lot of historical thumbnails/notes into the page, crowding out everything
// else. The header always shows the round count so it's clear there's
// something to expand.
function ReworkUploadSection({
  media,
  notes,
}: {
  media: StageMedia[]
  notes: { round: number; notes: string; created_at: string }[]
}) {
  const [open, setOpen] = useState(false)
  const rounds = [...new Set(media.map((m) => m.rework_round ?? 0))].sort((a, b) => a - b)
  const notesByRound = new Map(notes.map((n) => [n.round, n]))

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-status-rework"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        Rework Upload ({rounds.length} rework{rounds.length !== 1 ? "s" : ""})
      </button>
      {open && (
        <div className="mt-1.5 space-y-2.5">
          {rounds.map((round) => (
            <div key={round}>
              {rounds.length > 1 && <p className="mb-1 text-[10px] text-muted">Rework {round}</p>}
              {notesByRound.get(round) && (
                <p className="mb-1 text-xs italic text-body">Notes: {notesByRound.get(round)!.notes}</p>
              )}
              <MediaThumbs items={media.filter((m) => (m.rework_round ?? 0) === round)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MediaThumbs({ items }: { items: StageMedia[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((m) =>
        m.media_type === "photo" ? (
          <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.file_url}
              alt="stage media"
              className="h-16 w-16 rounded-sm border border-border object-cover transition-opacity hover:opacity-80"
            />
          </a>
        ) : (
          <a
            key={m.id}
            href={m.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            ▶ Video
          </a>
        ),
      )}
    </div>
  )
}

const STAGE_PILL: Record<string, string> = {
  pending: "bg-surface-muted text-muted",
  in_progress: "bg-status-ongoing/12 text-status-ongoing",
  done: "bg-status-inspection/12 text-status-inspection",
  for_rework: "bg-status-rework/12 text-status-rework",
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function JobOrderDetail({
  jobId,
  initialJob,
}: {
  jobId: string
  initialJob?: JobDetail | null
}) {
  const router = useRouter()
  const toast = useToast()
  const { isOnline, lockProps } = useOfflineLock()

  const [job, setJob] = useState<JobDetail | null>(initialJob ?? null)
  // initialJob means there's already something to show — skip the skeleton
  // and silently revalidate in the background instead (below).
  const [loading, setLoading] = useState(!initialJob)
  const [error, setError] = useState<string | null>(null)

  const [releasing, setReleasing] = useState(false)
  const [settingForRelease, setSettingForRelease] = useState(false)

  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendStatus, setResendStatus] = useState<Record<string, boolean | null>>({})

  const [reworkModal, setReworkModal] = useState<{ stageId: string; stageName: string } | null>(null)
  const [reworkNotes, setReworkNotes] = useState("")
  const [submittingRework, setSubmittingRework] = useState(false)
  const [reworkError, setReworkError] = useState<string | null>(null)

  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [completeConfirm, setCompleteConfirm] = useState(false)

  const [exportConfirm, setExportConfirm] = useState(false)

  const [subModal, setSubModal] = useState(false)
  const [subRole, setSubRole] = useState<"detailer" | "installer">("detailer")
  const [subTechs, setSubTechs] = useState<
    {
      id: string
      name: string
      role: string
      on_job: boolean
      is_available: boolean
      available_days: string[]
      availability_override_date: string | null
    }[]
  >([])
  const [subTechsLoading, setSubTechsLoading] = useState(false)
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null)
  const [addingSub, setAddingSub] = useState(false)
  const [subError, setSubError] = useState<string | null>(null)

  const [headSubModal, setHeadSubModal] = useState(false)
  const [headSubRole, setHeadSubRole] = useState<"head_detailer" | "head_installer">("head_detailer")
  const [headSubs, setHeadSubs] = useState<{ id: string; name: string; role: string; active_jobs: number }[]>([])
  const [headSubsLoading, setHeadSubsLoading] = useState(false)
  const [selectedHeadSubId, setSelectedHeadSubId] = useState<string | null>(null)
  const [addingHeadSub, setAddingHeadSub] = useState(false)
  const [headSubError, setHeadSubError] = useState<string | null>(null)

  // Removing a substitute (crew or head) — misclicked adds need an undo.
  const [removeSubTarget, setRemoveSubTarget] = useState<{ id: string; name: string; role: string } | null>(null)
  const [removingSub, setRemovingSub] = useState(false)
  const [removeSubError, setRemoveSubError] = useState<string | null>(null)

  const [scheduleModal, setScheduleModal] = useState(false)
  const [scheduleValue, setScheduleValue] = useState("")
  // Admin → AI Configuration's Operating Hours — defaults to the shop's
  // actual current hours while this loads, so nothing breaks/flashes wrong
  // (same convention as AddJobOrderForm's own copy of this fetch).
  const [operatingHours, setOperatingHours] = useState<{
    operating_days: Weekday[]
    operating_open_time: string
    operating_close_time: string
  }>({
    operating_days: DEFAULT_OPERATING_DAYS,
    operating_open_time: DEFAULT_OPERATING_OPEN_TIME,
    operating_close_time: DEFAULT_OPERATING_CLOSE_TIME,
  })
  const [schedulePreview, setSchedulePreview] = useState<string | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  const updatedEst = job?.updated_est ?? null

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load job order")
      setJob(json.job)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    // Already have initialJob from the server — revalidate silently in the
    // background instead of flashing the skeleton again.
    load({ silent: !!initialJob })
  }, [load, initialJob])

  // Intentionally not realtime: changes to a job reach Operations as
  // notifications (components/shared/NotificationBell.tsx), and clicking one
  // for the job already open here re-runs the mount revalidation above (the
  // server page hands down a fresh `initialJob`).

  async function markReleased() {
    setReleasing(true)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Released" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to release job")
      await load()
      toast.success("Job marked as completed.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setReleasing(false)
    }
  }

  async function setForRelease() {
    setSettingForRelease(true)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "For Release" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to set job for release")
      await load()
      toast.success("Job set for release.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSettingForRelease(false)
    }
  }

  async function resendStage(stageId: string) {
    setResendingId(stageId)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}/resend-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId }),
      })
      const json = await res.json()
      setResendStatus((prev) => ({ ...prev, [stageId]: res.ok ? true : false }))
      if (!res.ok) console.warn("Resend failed:", json?.error)
      else toast.success("Stage update resent to customer.")
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
      const res = await fetch(`/api/operations/job-orders/${jobId}/stage-rework`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: reworkModal.stageId, rework_notes: reworkNotes.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to flag stage for rework")
      setJob((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          status: "For Rework",
          stages: prev.stages.map((s) =>
            s.id === reworkModal.stageId
              ? { ...s, status: "for_rework", rework_instructions: reworkNotes.trim() }
              : s,
          ),
        }
      })
      setReworkModal(null)
      setReworkNotes("")
      toast.success("Stage flagged for rework.")
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
      const res = await fetch("/api/operations/job-management/list-technicians")
      const json = await res.json()
      setSubTechs(
        (json.crew_members ?? []).map((t: any) => ({
          id: t.id,
          name: t.full_name,
          role: t.role as string,
          on_job: t.on_job as boolean,
          is_available: t.is_available as boolean,
          available_days: (t.available_days as string[]) ?? [],
          availability_override_date: (t.availability_override_date as string | null) ?? null,
        })),
      )
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
      const res = await fetch(`/api/operations/job-orders/${jobId}/add-substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: selectedSubId, role: subRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to add substitute")
      setSubModal(false)
      setSelectedSubId(null)
      await load()
      toast.success("Substitute technician added.")
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingSub(false)
    }
  }

  async function openHeadSubModal() {
    setHeadSubModal(true)
    setHeadSubRole("head_detailer")
    setSelectedHeadSubId(null)
    setHeadSubError(null)
    setHeadSubsLoading(true)
    try {
      const res = await fetch("/api/operations/job-management/list-technicians")
      const json = await res.json()
      setHeadSubs(
        (json.technicians ?? []).map((t: { id: string; full_name: string; role: string; active_jobs?: number }) => ({
          id: t.id,
          name: t.full_name,
          role: t.role,
          active_jobs: t.active_jobs ?? 0,
        })),
      )
    } catch {
      setHeadSubError("Failed to load head technicians.")
    } finally {
      setHeadSubsLoading(false)
    }
  }

  // Crew already on THIS job (primary or substitute) are shown as assigned —
  // `on_job` alone would silently hide them (it means "on any active job").
  const crewOnJob = job ? (subRole === "detailer" ? job.detailers : job.installers).map((c) => c.id) : []
  const subCandidates = subTechs
    .filter((t) => t.role === subRole)
    .map((t) => ({ t, membership: alreadyOnJob(t.id, { substituteIds: crewOnJob }) }))
    .filter(({ t, membership }) => membership !== null || (isTechnicianAvailableToday(t) && !t.on_job))
    .sort((a, b) => Number(a.membership !== null) - Number(b.membership !== null))

  // Who's already on this job in the chosen head role, so they show as such
  // (and can't be picked) instead of being rejected by the server afterwards.
  const headTeam = job
    ? headSubRole === "head_detailer"
      ? { primaryId: job.head_detailer?.id, substituteIds: job.head_detailer_substitutes.map((s) => s.id) }
      : { primaryId: job.head_installer?.id, substituteIds: job.head_installer_substitutes.map((s) => s.id) }
    : {}
  const headCandidates = headSubs
    .filter((t) => t.role === headSubRole)
    .map((t) => ({ t, membership: alreadyOnJob(t.id, headTeam) }))
    .sort((a, b) => Number(a.membership !== null) - Number(b.membership !== null))
  const allHeadsOnJob = headCandidates.length > 0 && headCandidates.every((c) => c.membership !== null)

  async function addHeadSubstitute() {
    if (!selectedHeadSubId) return
    setAddingHeadSub(true)
    setHeadSubError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}/add-substitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: selectedHeadSubId, role: headSubRole }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to add substitute head technician")
      setHeadSubModal(false)
      setSelectedHeadSubId(null)
      await load()
      toast.success("Substitute head technician added.")
    } catch (err: unknown) {
      setHeadSubError(err instanceof Error ? err.message : String(err))
    } finally {
      setAddingHeadSub(false)
    }
  }

  function requestRemoveSubstitute(person: { id: string; name: string }, role: string) {
    setRemoveSubTarget({ ...person, role })
    setRemoveSubError(null)
  }

  async function confirmRemoveSubstitute() {
    if (!removeSubTarget) return
    setRemovingSub(true)
    setRemoveSubError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}/add-substitute`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: removeSubTarget.id, role: removeSubTarget.role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to remove substitute")
      setRemoveSubTarget(null)
      await load()
      toast.success("Substitute removed.")
    } catch (err: unknown) {
      setRemoveSubError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemovingSub(false)
    }
  }

  function openScheduleModal() {
    if (!job) return
    setScheduleValue(job.scheduled_at ? toDatetimeLocalValue(job.scheduled_at) : "")
    setSchedulePreview(null)
    setScheduleError(null)
    setScheduleModal(true)
    fetch("/api/operations/job-management/operating-hours")
      .then((r) => (r.ok ? r.json() : null))
      .then((hours) => {
        if (hours) {
          setOperatingHours({
            operating_days: hours.operating_days ?? DEFAULT_OPERATING_DAYS,
            operating_open_time: hours.operating_open_time ?? DEFAULT_OPERATING_OPEN_TIME,
            operating_close_time: hours.operating_close_time ?? DEFAULT_OPERATING_CLOSE_TIME,
          })
        }
      })
      .catch(() => {}) // keep the current-hours default already in state
  }

  // Est. Completion preview is computed server-side (same engine that
  // persists the estimate on save) — the browser never re-implements
  // working-hours math. Mirrors AddJobOrderForm's fetchEstimate.
  useEffect(() => {
    if (!scheduleModal || !scheduleValue || !job?.total_duration_mins) { setSchedulePreview(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/operations/job-management/estimate-completion", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            startIso:     new Date(scheduleValue).toISOString(),
            durationMins: job.total_duration_mins,
          }),
        })
        if (cancelled) return
        if (!res.ok) { setSchedulePreview(null); return }
        const data = await res.json()
        setSchedulePreview((data?.expected_display as string) ?? null)
      } catch {
        if (!cancelled) setSchedulePreview(null)
      }
    })()
    return () => { cancelled = true }
  }, [scheduleModal, scheduleValue, job?.total_duration_mins])

  async function saveScheduledStart() {
    if (!scheduleValue) return
    const selected = new Date(scheduleValue)
    if (selected <= new Date()) {
      setScheduleError("Scheduled date and time cannot be in the past.")
      return
    }
    const check = isWithinOperatingHours(operatingHours, selected)
    if (check.reason === "closed_day") {
      setScheduleError(`That date is closed. Open days: ${formatOperatingHours(operatingHours)}`)
      return
    }
    if (check.reason === "outside_hours") {
      setScheduleError(`Start time must be within working hours (${formatOperatingHours(operatingHours)})`)
      return
    }
    setSavingSchedule(true)
    setScheduleError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: new Date(scheduleValue).toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to update scheduled start")
      setScheduleModal(false)
      await load()
      toast.success("Scheduled start updated.")
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingSchedule(false)
    }
  }

  async function cancelJob() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}`, { method: "DELETE" })
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

  if (error || !job)
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-status-delayed">{error ?? "Job not found."}</p>
        <Link href="/dashboard/job-management" className="text-sm text-primary hover:underline">
          ← Back to Job Management
        </Link>
      </div>
    )

  const jobData = job

  function exportPDF() {
    const esc = (v: string) =>
      v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const rows: [string, string][] = [
      ["Job Order ID", jobData.job_order_code],
      ["Customer Name", jobData.customer_name],
      ["Email", jobData.email ?? "—"],
      ["Phone Number", jobData.contact_number],
      ["Vehicle", jobData.vehicle_unit],
      ["Plate Number", jobData.plate_number],
      ["Service", jobData.service],
    ]
    const rowsHtml = rows
      .map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`)
      .join("")
    const html = `<html><head><title>Job Order ${esc(jobData.job_order_code)}</title>
      <style>body{font-family:sans-serif;font-size:12px;color:#111;margin:32px}
      .brand{font-size:18px;font-weight:700}.branch{margin-top:2px;font-size:12px;color:#555}
      .meta{margin-top:10px;font-size:11px;color:#777}hr{border:none;border-top:2px solid #111;margin:14px 0 20px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #dddddd;padding:6px 8px;text-align:left}td:first-child{font-weight:600;width:40%;background:#f7f8f8}</style>
      </head><body>
      <div class="brand">826 Auto Aesthetic &amp; Protection</div>
      <div class="branch">Ortigas Extension</div>
      <div class="meta">Generated on ${esc(new Date().toLocaleString())}</div>
      <hr />
      <table><tbody>${rowsHtml}</tbody></table></body></html>`
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, "_blank")
    if (win) win.addEventListener("load", () => { win.print(); URL.revokeObjectURL(url) })
  }

  const categoryGroups = job.stages.reduce((acc, s) => {
    const key = s.category_id ?? `_${s.category_name}`
    if (!acc.has(key)) {
      acc.set(key, { name: s.category_name ?? "Unknown", color: s.category_color ?? "blue", stages: [] })
    }
    acc.get(key)!.stages.push(s)
    return acc
  }, new Map<string, { name: string; color: string; stages: Stage[] }>())

  const lastStage =
    job.stages.length > 0
      ? job.stages.reduce(
          (max, s) => ((s.sequence_order ?? 0) > (max.sequence_order ?? 0) ? s : max),
          job.stages[0],
        )
      : null
  const lastCategoryKey = lastStage ? lastStage.category_id ?? `_${lastStage.category_name}` : null

  const canRelease = job.status === "For Release"
  const hasReworkStages = job.stages.some((s) => s.status === "for_rework")
  const showForReleased = !["For Release", "Released"].includes(job.status)
  const canForReleased =
    !hasReworkStages &&
    (job.status === "For Inspection" ||
      (Boolean(job.finishing_approved_at) && !["For Release", "Released"].includes(job.status)))
  const displayId = job.job_order_code

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/job-management"
          className="flex items-center gap-1.5 text-sm text-body transition-colors hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Job Management
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {job.status !== "Released" && (
            <Button variant="secondary" onClick={() => setExportConfirm(true)}>
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          {job.status === "Pending" && (
            <Button variant="danger" onClick={() => setCancelConfirm(true)} {...lockProps}>
              <Trash2 className="h-4 w-4" />
              Cancel Job
            </Button>
          )}
          {showForReleased && (
            <Button
              onClick={canForReleased ? setForRelease : undefined}
              disabled={settingForRelease || !canForReleased || !isOnline}
              title={
                !isOnline
                  ? OFFLINE_ACTION_HINT
                  : !canForReleased
                    ? hasReworkStages
                      ? "All stages flagged for rework must be resolved by the technician first."
                      : "Waiting for the Head Detailer to complete finishing stages and pass to Operations."
                    : undefined
              }
            >
              <PackageCheck className="h-4 w-4" />
              {settingForRelease ? "Processing…" : "For Release"}
            </Button>
          )}
          {canRelease && (
            <Button onClick={() => setCompleteConfirm(true)} disabled={releasing} {...lockProps}>
              <PackageCheck className="h-4 w-4" />
              {releasing ? "Completing…" : "Mark as Completed"}
            </Button>
          )}
        </div>
      </div>
      {!isOnline && <OfflinePausedNote className="-mt-2" />}

      {/* Job Info Card */}
      <Card>
        <CardBody>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 font-mono text-xs text-muted">{displayId}</p>
              <h1 className="text-xl font-bold text-heading">{job.customer_name}</h1>
              <p className="mt-0.5 text-sm text-body">{job.contact_number}</p>
              {job.email && <p className="mt-0.5 text-sm text-body">{job.email}</p>}
            </div>
            <StatusBadge status={displayJobStatus(job.status, job.is_overdue)} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <InfoCell label="Vehicle" value={job.vehicle_unit} />
            <InfoCell label="Plate" value={job.plate_number} accent />
            <InfoCell label="Service" value={job.service} />
            {job.status === "Pending" ? (
              <button
                type="button"
                onClick={openScheduleModal}
                className="group text-left disabled:cursor-not-allowed disabled:opacity-60"
                title={isOnline ? "Edit scheduled start" : OFFLINE_ACTION_HINT}
                {...lockProps}
              >
                <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">Scheduled Start</p>
                <p className="flex items-center gap-1 font-medium text-body group-hover:text-primary">
                  {fmtDateTime(job.scheduled_at)}
                  <Pencil className="h-3 w-3 text-muted group-hover:text-primary" />
                </p>
              </button>
            ) : (
              <InfoCell label="Scheduled Start" value={fmtDateTime(job.scheduled_at)} />
            )}
            <CrewCell
              label="Head Detailer"
              lead={job.head_detailer?.full_name ?? "Unassigned"}
              substituteLabel={substituteRoleLabel("head_detailer")}
              substitutes={job.head_detailer_substitutes.map((s) => ({ id: s.id, name: s.full_name }))}
              crew={job.detailers}
              headRole="head_detailer"
              crewRole="detailer"
              onRemoveSubstitute={requestRemoveSubstitute}
            />
            <CrewCell
              label="Head Installer"
              lead={job.head_installer?.full_name ?? "Unassigned"}
              substituteLabel={substituteRoleLabel("head_installer")}
              substitutes={job.head_installer_substitutes.map((s) => ({ id: s.id, name: s.full_name }))}
              crew={job.installers}
              headRole="head_installer"
              crewRole="installer"
              onRemoveSubstitute={requestRemoveSubstitute}
            />
            <InfoCell label="Started" value={fmtDateTime(job.actual_start_at)} />
            <InfoCell label="Est. Completion" value={fmtDateTime(job.expected_completion_at)} />
            {updatedEst && (
              <div>
                <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">Updated Est.</p>
                <p className="font-medium text-status-onjob">{fmtDateTime(updatedEst)}</p>
              </div>
            )}
            {job.status !== "Released" && (
              <div className="col-span-2 flex flex-col gap-2 pt-1 md:col-span-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={openHeadSubModal} {...lockProps}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Substitute Head Technician
                  </Button>
                  <Button variant="secondary" size="sm" onClick={openSubModal} {...lockProps}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Add Substitute Technician
                  </Button>
                </div>
                {!isOnline && <OfflinePausedNote />}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Stage Progress */}
      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-body">
            Service Stage Progress
          </h2>

          {Array.from(categoryGroups.entries()).map(([key, group]) => {
            const isLastCategory = key === lastCategoryKey
            const extra = isLastCategory
              ? job.finishing_approved_at
                ? `Passed to Operations · ${fmtDateTime(job.finishing_approved_at)}`
                : "Awaiting handoff to Operations"
              : null
            const swatch = categorySwatch(group.color)
            return (
              <div key={key} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className={cn("h-2 w-2 rounded-full", swatch.dot)} />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {group.name} stages
                  </p>
                  {extra && (
                    <Badge
                      className={
                        job.finishing_approved_at
                          ? "bg-status-inspection/12 text-status-inspection"
                          : "bg-status-warning/12 text-status-warning"
                      }
                    >
                      {extra}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {group.stages.map((stage) => (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-start gap-3 rounded-sm border p-3",
                        stage.status === "for_rework"
                          ? "border-status-rework/30 bg-status-rework/5"
                          : "border-border-subtle bg-surface-subtle",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          stage.status === "done"
                            ? "bg-status-inspection text-white"
                            : stage.status === "for_rework"
                              ? "bg-status-rework text-white"
                              : "bg-surface-muted text-muted",
                        )}
                      >
                        {stage.status === "done" ? "✓" : stage.sequence_order ?? "—"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-heading">{stage.name}</span>
                            <Badge className={STAGE_PILL[stage.status]}>
                              {stage.status.replace("_", " ")}
                            </Badge>
                            {stage.is_delayed && (
                              <Badge className="bg-status-delayed/12 text-status-delayed">
                                <Clock className="h-3 w-3" /> Delayed
                              </Badge>
                            )}
                            {stage.completed_at && (
                              <span className="text-xs text-muted">{fmtDateTime(stage.completed_at)}</span>
                            )}
                          </div>
                          {job.status === "For Inspection" && stage.status !== "for_rework" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReworkModal({ stageId: stage.id, stageName: stage.name })
                                setReworkNotes("")
                                setReworkError(null)
                              }}
                              className="flex shrink-0 items-center gap-1 rounded-sm bg-status-rework/12 px-2 py-1 text-xs font-medium text-status-rework hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                              {...lockProps}
                            >
                              <RotateCcw className="h-3 w-3" />
                              For Rework
                            </button>
                          )}
                        </div>
                        {stage.status !== "done" && stage.expected_end_at && (
                          <p className={cn("mt-0.5 text-xs", stage.is_delayed ? "text-status-delayed" : "text-muted")}>
                            Expected by {fmtDateTime(stage.expected_end_at)}
                          </p>
                        )}

                        {stage.status === "done" && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <SendIndicator
                              sent={
                                resendStatus[stage.id] !== undefined
                                  ? resendStatus[stage.id]
                                  : stage.messenger_sent
                              }
                              sentAt={stage.messenger_sent_at}
                            />
                            {job.status !== "Released" && (resendStatus[stage.id] !== undefined
                              ? resendStatus[stage.id]
                              : stage.messenger_sent) !== true && (
                              <button
                                type="button"
                                title={isOnline ? "Resend stage update to customer via Messenger" : OFFLINE_ACTION_HINT}
                                onClick={() => resendStage(stage.id)}
                                disabled={resendingId === stage.id || !isOnline}
                                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <RefreshCw className={cn("h-3 w-3", resendingId === stage.id && "animate-spin")} />
                                {resendingId === stage.id ? "Resending…" : "Resend stage update"}
                              </button>
                            )}
                          </div>
                        )}

                        {stage.rework_instructions && (
                          <p className="mt-1 text-xs text-status-rework">Rework: {stage.rework_instructions}</p>
                        )}
                        {stage.completion_notes && (
                          <p className="mt-1 text-xs italic text-body">Notes: {stage.completion_notes}</p>
                        )}

                        {(stage.media.length > 0 || stage.rework_media.length > 0) && (
                          <div className="mt-2 flex flex-wrap items-start gap-6">
                            {stage.media.length > 0 && (
                              <div>
                                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                                  Initial Upload
                                </p>
                                <MediaThumbs items={stage.media} />
                              </div>
                            )}
                            {stage.rework_media.length > 0 && (
                              <ReworkUploadSection media={stage.rework_media} notes={stage.rework_notes} />
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
        </CardBody>
      </Card>

      {/* Status History */}
      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-body">Status History</h2>
          <div className="flex flex-col gap-2">
            {job.history.length === 0 ? (
              <p className="text-sm text-muted">No history recorded.</p>
            ) : (
              job.history.map((h, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", statusStyle(h.status).dot)} />
                  <span className="w-28 shrink-0 font-medium text-body">{h.status}</span>
                  <span className="text-xs text-muted">{fmtDateTime(h.created_at)}</span>
                  <span className="ml-auto text-xs text-muted">{h.changed_by}</span>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      {/* Export PDF Confirmation */}
      <ConfirmModal
        open={exportConfirm}
        onClose={() => setExportConfirm(false)}
        onConfirm={() => {
          setExportConfirm(false)
          exportPDF()
        }}
        title="Export Job Order as PDF"
        message={`Export ${job.customer_name}'s job order? This opens a print preview in a new tab.`}
        confirmLabel="Export"
        cancelLabel="Cancel"
        tone="primary"
        icon={FileText}
      />

      {/* Mark as Completed Confirmation */}
      <ConfirmModal
        open={completeConfirm}
        onClose={() => setCompleteConfirm(false)}
        onConfirm={async () => {
          setCompleteConfirm(false)
          await markReleased()
        }}
        title="Mark Job as Completed"
        message={`Mark ${job.customer_name}'s job as completed? This closes the job out for good — make sure this wasn't a misclick.`}
        confirmLabel="Yes, Mark Completed"
        cancelLabel="Go Back"
        tone="primary"
        loading={releasing}
        icon={PackageCheck}
      />

      {/* Cancel Confirmation */}
      <ConfirmModal
        open={cancelConfirm}
        onClose={() => {
          setCancelConfirm(false)
          setCancelError(null)
        }}
        onConfirm={cancelJob}
        title="Cancel Job Order"
        message={
          cancelError ??
          `Cancel ${job.customer_name}? This cannot be undone — the job and all its records will be permanently deleted.`
        }
        confirmLabel="Yes, Cancel Job"
        cancelLabel="Go Back"
        tone="danger"
        loading={cancelling}
        icon={Trash2}
      />

      {/* Substitute Technician Modal */}
      <Modal
        open={subModal}
        onClose={() => {
          setSubModal(false)
          setSubError(null)
        }}
        title="Add Substitute Technician"
        description="The substitute is added alongside the existing team — no one is removed."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSubModal(false)} disabled={addingSub}>
              Cancel
            </Button>
            <Button onClick={addSubstitute} disabled={!selectedSubId || addingSub}>
              {addingSub ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Substitute"}
            </Button>
          </>
        }
      >
        <div className="mb-4 flex gap-2">
          {(["detailer", "installer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setSubRole(r)
                setSelectedSubId(null)
              }}
              className={cn(
                "flex-1 rounded-sm py-1.5 text-xs font-semibold capitalize transition-colors",
                subRole === r ? "bg-primary text-white" : "bg-surface-muted text-body hover:text-heading",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="max-h-52 space-y-1 overflow-y-auto">
          {subTechsLoading ? (
            <div className="flex items-center justify-center py-6 text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : subCandidates.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No available technicians.</p>
          ) : (
            <>
              {subCandidates.every((c) => c.membership !== null) && (
                <p className="pb-1 text-center text-xs text-muted">Everyone available is already on this job.</p>
              )}
              {subCandidates.map(({ t, membership }) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={membership !== null}
                  onClick={() => setSelectedSubId(t.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-sm transition-colors",
                    membership !== null
                      ? "cursor-not-allowed border-border-subtle bg-surface-muted/60 text-muted"
                      : selectedSubId === t.id
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-subtle text-body hover:bg-surface-muted",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  {membership !== null ? (
                    <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">
                      Assigned {subRole}
                    </span>
                  ) : (
                    <StatusBadge status={t.on_job ? "On Job" : isTechnicianAvailableToday(t) ? "Available" : "Unavailable"} />
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {subError && <p className="mt-3 text-xs text-status-delayed">{subError}</p>}
      </Modal>

      {/* Substitute Head Technician Modal */}
      <Modal
        open={headSubModal}
        onClose={() => {
          setHeadSubModal(false)
          setHeadSubError(null)
        }}
        title="Add Substitute Head Technician"
        description="The substitute is added alongside the existing team — no one is removed. They can work the job on their own Head Technician screen."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHeadSubModal(false)} disabled={addingHeadSub}>
              Cancel
            </Button>
            <Button onClick={addHeadSubstitute} disabled={!selectedHeadSubId || addingHeadSub}>
              {addingHeadSub ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Substitute"}
            </Button>
          </>
        }
      >
        <div className="mb-4 flex gap-2">
          {(["head_detailer", "head_installer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setHeadSubRole(r)
                setSelectedHeadSubId(null)
              }}
              className={cn(
                "flex-1 rounded-sm py-1.5 text-xs font-semibold transition-colors",
                headSubRole === r ? "bg-primary text-white" : "bg-surface-muted text-body hover:text-heading",
              )}
            >
              {r === "head_detailer" ? "Head Detailer" : "Head Installer"}
            </button>
          ))}
        </div>

        <div className="max-h-52 space-y-1 overflow-y-auto">
          {headSubsLoading ? (
            <div className="flex items-center justify-center py-6 text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : headCandidates.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No head technicians of this role.</p>
          ) : (
            <>
              {allHeadsOnJob && (
                <p className="pb-1 text-center text-xs text-muted">Everyone in this role is already on this job.</p>
              )}
              {headCandidates.map(({ t, membership }) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={membership !== null}
                  onClick={() => setSelectedHeadSubId(t.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-sm transition-colors",
                    membership !== null
                      ? "cursor-not-allowed border-border-subtle bg-surface-muted/60 text-muted"
                      : selectedHeadSubId === t.id
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-subtle text-body hover:bg-surface-muted",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  {membership === "primary" ? (
                    <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Assigned {headSubRole === "head_detailer" ? "Head Detailer" : "Head Installer"}
                    </span>
                  ) : membership === "substitute" ? (
                    <span className="rounded-full bg-status-info/15 px-2 py-0.5 text-[10px] font-semibold text-status-info">
                      Already a substitute
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted">
                      {t.active_jobs} active job{t.active_jobs === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {headSubError && <p className="mt-3 text-xs text-status-delayed">{headSubError}</p>}
      </Modal>

      {/* Remove Substitute confirmation — covers both crew and head substitutes */}
      <ConfirmModal
        open={removeSubTarget !== null}
        onClose={() => { if (!removingSub) { setRemoveSubTarget(null); setRemoveSubError(null) } }}
        onConfirm={confirmRemoveSubstitute}
        title="Remove Substitute?"
        message={
          <>
            Remove <strong>{removeSubTarget?.name}</strong> as a substitute on this job? This can&apos;t
            be undone — you&apos;d need to add them again.
            {removeSubError && <span className="mt-2 block text-status-delayed">{removeSubError}</span>}
          </>
        }
        confirmLabel="Remove"
        tone="danger"
        loading={removingSub}
        icon={X}
      />

      {/* Edit Scheduled Start Modal */}
      <Modal
        open={scheduleModal}
        onClose={() => {
          setScheduleModal(false)
          setScheduleError(null)
        }}
        title="Edit Scheduled Start"
        description="Only available while the job is Pending. Est. Completion updates to match."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduleModal(false)} disabled={savingSchedule}>
              Cancel
            </Button>
            <Button onClick={saveScheduledStart} disabled={!scheduleValue || savingSchedule}>
              {savingSchedule ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-body">Scheduled Date &amp; Time</label>
          <Input
            aria-label="Scheduled Date and Time"
            type="datetime-local"
            min={`${new Date().toISOString().split("T")[0]}T${operatingHours.operating_open_time}`}
            value={scheduleValue}
            onChange={(e) => { setScheduleValue(e.target.value); setScheduleError(null) }}
          />
          <p className="text-[10px] text-muted">Working hours: {formatOperatingHours(operatingHours)}</p>
        </div>

        {scheduleValue && (
          <div className="mt-4 rounded-sm border border-border-subtle bg-surface-muted px-3 py-2">
            <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">New Est. Completion</p>
            <p className="font-medium text-body">{schedulePreview ?? "Calculating…"}</p>
          </div>
        )}

        {scheduleError && <p className="mt-3 text-xs text-status-delayed">{scheduleError}</p>}
      </Modal>

      {/* Stage Rework Modal */}
      <Modal
        open={reworkModal !== null}
        onClose={() => {
          setReworkModal(null)
          setReworkNotes("")
          setReworkError(null)
        }}
        title="Flag Stage for Rework"
        description={reworkModal ? `Stage: ${reworkModal.stageName}` : undefined}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setReworkModal(null)
                setReworkNotes("")
              }}
              disabled={submittingRework}
            >
              Cancel
            </Button>
            <Button onClick={flagStageForRework} disabled={submittingRework || !reworkNotes.trim()}>
              {submittingRework ? "Flagging…" : "Flag for Rework"}
            </Button>
          </>
        }
      >
        <Textarea
          value={reworkNotes}
          onChange={(e) => setReworkNotes(e.target.value)}
          placeholder="Describe what needs to be fixed…"
          rows={4}
        />
        {reworkError && <p className="mt-2 text-xs text-status-delayed">{reworkError}</p>}
      </Modal>
    </div>
  )
}

// Converts a stored ISO timestamp to a `datetime-local` input value, using
// the browser's own local time — the same interpretation the browser applies
// when that value is later read back via `new Date(value)` on save, so the
// round trip never drifts (matches AddJobOrderForm's resolveStartDate).
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function InfoCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("font-medium", accent ? "text-primary" : "text-body")}>{value}</p>
    </div>
  )
}

function SendIndicator({ sent, sentAt }: { sent: boolean | null; sentAt: string | null }) {
  if (sent === true) {
    return (
      <Badge className="bg-status-inspection/12 text-status-inspection">
        <CheckCircle2 className="h-3 w-3" />
        Update sent{sentAt ? ` · ${fmtDateTime(sentAt)}` : ""}
      </Badge>
    )
  }
  if (sent === false) {
    return (
      <Badge className="bg-status-delayed/12 text-status-delayed">
        <XCircle className="h-3 w-3" />
        Update failed{sentAt ? ` · ${fmtDateTime(sentAt)}` : ""}
      </Badge>
    )
  }
  return (
    <Badge className="bg-surface-muted text-muted">
      <Clock className="h-3 w-3" />
      Update not sent
    </Badge>
  )
}

function CrewCell({
  label,
  lead,
  crew,
  substitutes = [],
  substituteLabel,
  headRole,
  crewRole,
  onRemoveSubstitute,
}: {
  label: string
  lead: string
  crew: { id: string; name: string; is_substitute: boolean }[]
  /** Substitute head technicians — always visible, never folded into the crew list. */
  substitutes?: { id: string; name: string }[]
  substituteLabel?: string
  /** Passed to onRemoveSubstitute for a head substitute row. */
  headRole?: "head_detailer" | "head_installer"
  /** Passed to onRemoveSubstitute for a crew substitute row. */
  crewRole?: "detailer" | "installer"
  onRemoveSubstitute?: (person: { id: string; name: string }, role: string) => void
}) {
  const [open, setOpen] = useState(false)
  const collapsible = crew.length >= 2

  const removeBtn = (person: { id: string; name: string }, role: string) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRemoveSubstitute?.(person, role) }}
      title={`Remove ${person.name} as substitute`}
      aria-label={`Remove ${person.name} as substitute`}
      className="text-muted transition-colors hover:text-status-delayed"
    >
      <X size={11} />
    </button>
  )

  return (
    <div>
      <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium text-body">{lead}</p>
      {substitutes.length > 0 && (
        <ul className="mt-1 space-y-1">
          {substitutes.map((sub) => (
            <li key={sub.id} className="flex flex-wrap items-center gap-1.5 text-sm text-body">
              <span className="rounded-full bg-status-info/15 px-2 py-0.5 text-[11px] font-semibold text-status-info">
                {substituteLabel ?? "Substitute"}
              </span>
              {sub.name}
              {onRemoveSubstitute && headRole && removeBtn(sub, headRole)}
            </li>
          ))}
        </ul>
      )}
      {crew.length > 0 && (
        <div className="mt-1">
          {collapsible ? (
            <>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-body"
              >
                <Users size={11} />
                {crew.length} crew members
                <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <ul className="mt-1 space-y-0.5 pl-1">
                  {crew.map((m) => (
                    <li key={m.id} className="flex items-center gap-1.5 text-xs text-body">
                      {m.name}
                      {m.is_substitute && (
                        <span className="rounded-full bg-status-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-info">Sub</span>
                      )}
                      {m.is_substitute && onRemoveSubstitute && crewRole && removeBtn(m, crewRole)}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <ul className="space-y-0.5 pl-1">
              {crew.map((m) => (
                <li key={m.id} className="flex items-center gap-1.5 text-xs text-body">
                  <Users size={10} className="text-muted" />
                  {m.name}
                  {m.is_substitute && (
                    <span className="rounded-full bg-status-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-info">Sub</span>
                  )}
                  {m.is_substitute && onRemoveSubstitute && crewRole && removeBtn(m, crewRole)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
