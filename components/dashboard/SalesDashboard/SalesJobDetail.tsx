"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, CheckCircle2, RefreshCw, Clock } from "lucide-react"

interface StageMedia {
  id:         string
  file_url:   string
  media_type: "photo" | "video"
}

interface Stage {
  id:                  string
  name:                string
  sequence_order:      number
  category:            "preparation" | "installation" | "finishing"
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

interface TeamMember { id: string; full_name: string }
interface CrewMember  { id: string; name: string }

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

const STATUS_COLORS: Record<string, string> = {
  Pending:       "bg-yellow-50 text-yellow-700 border-yellow-200",
  Ongoing:       "bg-blue-50 text-blue-700 border-blue-200",
  "For Rework":  "bg-orange-50 text-orange-700 border-orange-200",
  "For Release": "bg-purple-50 text-purple-700 border-purple-200",
  Released:      "bg-green-50 text-green-700 border-green-200",
  Delayed:       "bg-red-50 text-red-700 border-red-200",
  Cancelled:     "bg-gray-50 text-gray-500 border-gray-200",
}

const STAGE_STATUS_PILL: Record<string, string> = {
  pending:     "bg-gray-100 text-gray-500",
  in_progress: "bg-blue-100 text-blue-700",
  done:        "bg-green-100 text-green-700",
  for_rework:  "bg-orange-100 text-orange-700",
}

function StageIcon({ status }: { status: string }) {
  if (status === "done")       return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (status === "for_rework") return <RefreshCw    className="w-4 h-4 text-orange-500 shrink-0" />
  if (status === "in_progress")return <Clock        className="w-4 h-4 text-blue-400 shrink-0" />
  return <div className="w-4 h-4 rounded-full border-2 border-gray-200 shrink-0" />
}

function SectionCollapse({ title, count, children, accent }: {
  title: string; count: number; children: React.ReactNode; accent: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>{title}</span>
          <span className="text-xs text-gray-400">({count} stages)</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="divide-y divide-gray-50">{children}</div>}
    </div>
  )
}

export default function SalesJobDetail({ jobId }: { jobId: string }) {
  const [job, setJob]       = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/operations/job-orders/${jobId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load job")
      setJob(json.job ?? null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">Loading…</div>
  )
  if (error || !job) return (
    <div className="flex flex-col items-center gap-3 py-24">
      <p className="text-sm text-red-500">{error ?? "Job not found."}</p>
      <Link href="/dashboard/sales/jobs" className="text-xs text-blue-500 hover:underline">← Back to Job Management</Link>
    </div>
  )

  const displayId   = `JO-${new Date(job.created_at).getFullYear()}-${job.id.slice(-4).toUpperCase()}`
  const prepStages  = job.stages.filter((s) => s.category === "preparation")
  const instStages  = job.stages.filter((s) => s.category === "installation")
  const finStages   = job.stages.filter((s) => s.category === "finishing")
  const totalStages = job.stages.length
  const doneStages  = job.stages.filter((s) => s.status === "done").length
  const progress    = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0

  return (
    <div className="max-w-4xl flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/sales/job-orders"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Management
          </Link>
          <h1 className="text-xl font-bold text-gray-800">{displayId}</h1>
        </div>
        <span className={`mt-6 inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
          {job.status}
        </span>
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-xs text-blue-600 font-medium">
        <span>View only — modifications are handled by Operations.</span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
          <InfoRow label="Name"    value={job.customer_name  || "—"} />
          <InfoRow label="Plate"   value={job.plate_number   || "—"} />
          <InfoRow label="Vehicle" value={job.vehicle_unit   || "—"} />
          <InfoRow label="Contact" value={job.contact_number || "—"} />
        </div>

        {/* Service + Timeline */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Service &amp; Timeline</p>
          <InfoRow label="Service"   value={job.service} />
          <InfoRow label="Scheduled" value={fmtDate(job.scheduled_at)} />
          <InfoRow label="Started"   value={fmtDate(job.actual_start_at)} />
          <InfoRow label="Est. End"  value={fmtDate(job.expected_completion_at)} />
          {job.finishing_approved_at && (
            <InfoRow label="Finishing Passed" value={fmtDate(job.finishing_approved_at)} />
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-medium text-gray-500">
          <span>Overall Progress</span>
          <span>{doneStages} / {totalStages} stages · {progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-500" : progress >= 50 ? "bg-blue-500" : "bg-gray-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Team */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Team</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">Head Detailer</p>
            <p className="text-sm font-medium text-gray-800">{job.head_detailer?.full_name ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Head Installer</p>
            <p className="text-sm font-medium text-gray-800">{job.head_installer?.full_name ?? "Unassigned"}</p>
          </div>
          {job.detailers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Detailers</p>
              <ul className="space-y-0.5">
                {job.detailers.map((d) => (
                  <li key={d.id} className="text-sm text-gray-700">{d.name}</li>
                ))}
              </ul>
            </div>
          )}
          {job.installers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Installers</p>
              <ul className="space-y-0.5">
                {job.installers.map((i) => (
                  <li key={i.id} className="text-sm text-gray-700">{i.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Workflow Stages</p>

        {prepStages.length > 0 && (
          <SectionCollapse title="Preparation" count={prepStages.length} accent="text-blue-600">
            {prepStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {instStages.length > 0 && (
          <SectionCollapse title="Installation" count={instStages.length} accent="text-purple-600">
            {instStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {finStages.length > 0 && (
          <SectionCollapse title="Finishing" count={finStages.length} accent="text-emerald-600">
            {finStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {job.stages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">No stages found for this job.</p>
        )}
      </div>

      {/* History */}
      {job.history.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status History</p>
          <div className="flex flex-col gap-3">
            {job.history.map((h, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{h.status}</p>
                  <p className="text-xs text-gray-400">{fmtDate(h.created_at)} · {h.changed_by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StageRow({ stage }: { stage: Stage }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <StageIcon status={stage.status} />
        <span className="text-sm font-medium text-gray-800 flex-1">
          {stage.sequence_order}. {stage.name}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_STATUS_PILL[stage.status] ?? "bg-gray-100 text-gray-500"}`}>
          {stage.status.replace("_", " ")}
        </span>
      </div>
      {stage.rework_instructions && (
        <p className="text-xs text-orange-600 ml-6.5 bg-orange-50 rounded-lg px-2.5 py-1.5">
          Rework: {stage.rework_instructions}
        </p>
      )}
      {stage.completed_at && (
        <p className="text-[11px] text-emerald-600 ml-6.5">✓ Done {stage.completed_at}</p>
      )}
      {stage.media.length > 0 && (
        <div className="flex gap-2 ml-6.5 flex-wrap mt-1">
          {stage.media.map((m) =>
            m.media_type === "photo" ? (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={m.file_url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline px-2 py-1 border border-blue-100 rounded-lg">
                ▶ Video
              </a>
            )
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right">{value}</span>
    </div>
  )
}
