"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, PackageCheck, ChevronDown, Users, RefreshCw, CheckCircle2, XCircle,
  Clock, RotateCcw, UserPlus, Loader2, Trash2, FileText, Pencil,
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
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import { displayJobStatus } from "@/lib/job-delay"
import { categorySwatch } from "@/lib/ui/category-colors"
import { fmtDateTime } from "@/lib/time-display"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageMedia {
  id: string
  file_url: string
  media_type: "photo" | "video"
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
  media: StageMedia[]
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

  const [subModal, setSubModal] = useState(false)
  const [subRole, setSubRole] = useState<"detailer" | "installer">("detailer")
  const [subTechs, setSubTechs] = useState<
    { id: string; name: string; role: string; on_job: boolean; is_available: boolean }[]
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

  const [scheduleModal, setScheduleModal] = useState(false)
  const [scheduleValue, setScheduleValue] = useState("")
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

  // A technician updating this job's stages, or its own row changing (status,
  // team assignment, schedule), should reflect here immediately — silent (no
  // skeleton, no toast) so it doesn't interrupt anyone mid-read. This covers
  // everything the manual Refresh button used to be needed for, so that
  // button is gone now.
  useRealtimeRefetch(["job_stage_progress", "job_order"], useCallback(() => load({ silent: true }), [load]))

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

  function openScheduleModal() {
    if (!job) return
    setScheduleValue(job.scheduled_at ? toDatetimeLocalValue(job.scheduled_at) : "")
    setSchedulePreview(null)
    setScheduleError(null)
    setScheduleModal(true)
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
      <style>body{font-family:sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #dddddd;padding:6px 8px;text-align:left}td:first-child{font-weight:600;width:40%;background:#f7f8f8}</style>
      </head><body><h2>Job Order ${esc(jobData.job_order_code)}</h2>
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
            <Button variant="secondary" onClick={exportPDF}>
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          )}
          {job.status === "Pending" && (
            <Button variant="danger" onClick={() => setCancelConfirm(true)}>
              <Trash2 className="h-4 w-4" />
              Cancel Job
            </Button>
          )}
          {showForReleased && (
            <Button
              onClick={canForReleased ? setForRelease : undefined}
              disabled={settingForRelease || !canForReleased}
              title={
                !canForReleased
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
            <Button onClick={() => setCompleteConfirm(true)} disabled={releasing}>
              <PackageCheck className="h-4 w-4" />
              {releasing ? "Completing…" : "Mark as Completed"}
            </Button>
          )}
        </div>
      </div>

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
                className="group text-left"
                title="Edit scheduled start"
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
              crew={[
                ...job.head_detailer_substitutes.map((s) => ({ id: s.id, name: `${s.full_name} (substitute)` })),
                ...job.detailers,
              ]}
            />
            <CrewCell
              label="Head Installer"
              lead={job.head_installer?.full_name ?? "Unassigned"}
              crew={[
                ...job.head_installer_substitutes.map((s) => ({ id: s.id, name: `${s.full_name} (substitute)` })),
                ...job.installers,
              ]}
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
              <div className="col-span-2 flex flex-wrap gap-2 pt-1 md:col-span-4">
                <Button variant="secondary" size="sm" onClick={openHeadSubModal}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Substitute Head Technician
                </Button>
                <Button variant="secondary" size="sm" onClick={openSubModal}>
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Substitute Technician
                </Button>
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
                              className="flex shrink-0 items-center gap-1 rounded-sm bg-status-rework/12 px-2 py-1 text-xs font-medium text-status-rework hover:brightness-95"
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
                                title="Resend stage update to customer via Messenger"
                                onClick={() => resendStage(stage.id)}
                                disabled={resendingId === stage.id}
                                className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
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

                        {stage.media.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {stage.media.map((m) =>
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
          ) : subTechs.filter((t) => t.role === subRole && t.is_available && !t.on_job).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No available technicians.</p>
          ) : (
            subTechs
              .filter((t) => t.role === subRole && t.is_available && !t.on_job)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedSubId(t.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-sm transition-colors",
                    selectedSubId === t.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border-subtle text-body hover:bg-surface-muted",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  <StatusBadge status={t.on_job ? "On Job" : t.is_available ? "Available" : "Unavailable"} />
                </button>
              ))
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
          ) : headSubs.filter((t) => t.role === headSubRole).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">No head technicians of this role.</p>
          ) : (
            headSubs
              .filter((t) => t.role === headSubRole)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedHeadSubId(t.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-sm transition-colors",
                    selectedHeadSubId === t.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border-subtle text-body hover:bg-surface-muted",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-[10px] text-muted">
                    {t.active_jobs} active job{t.active_jobs === 1 ? "" : "s"}
                  </span>
                </button>
              ))
          )}
        </div>

        {headSubError && <p className="mt-3 text-xs text-status-delayed">{headSubError}</p>}
      </Modal>

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
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
          />
          <p className="text-[10px] text-muted">Working hours: 8:00 AM – 8:00 PM</p>
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
}: {
  label: string
  lead: string
  crew: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const collapsible = crew.length >= 2

  return (
    <div>
      <p className="mb-0.5 text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium text-body">{lead}</p>
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
                    <li key={m.id} className="text-xs text-body">
                      {m.name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <ul className="space-y-0.5 pl-1">
              {crew.map((m) => (
                <li key={m.id} className="flex items-center gap-1 text-xs text-body">
                  <Users size={10} className="text-muted" />
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
