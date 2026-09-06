"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, CheckCircle2, RefreshCw, Clock } from "lucide-react"
import { fmtDateTime } from "@/lib/time-display"
import { StatusBadge, Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"

interface StageMedia {
  id:         string
  file_url:   string
  media_type: "photo" | "video"
}

interface Stage {
  id:                  string
  name:                string
  sequence_order:      number
  category_name:       string | null
  status:              string
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
  job_order_code:         string
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


function StageIcon({ status }: { status: string }) {
  if (status === "done")       return <CheckCircle2 className="w-4 h-4 text-status-inspection shrink-0" />
  if (status === "for_rework") return <RefreshCw    className="w-4 h-4 text-status-rework shrink-0" />
  if (status === "in_progress")return <Clock        className="w-4 h-4 text-primary/70 shrink-0" />
  return <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
}

function SectionCollapse({ title, count, children, accent }: {
  title: string; count: number; children: React.ReactNode; accent: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-border-subtle rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-subtle hover:bg-surface-muted transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-widest ${accent}`}>{title}</span>
          <span className="text-xs text-muted">({count} stages)</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="divide-y divide-border-subtle">{children}</div>}
    </div>
  )
}

export default function SalesJobDetail({ job }: { job: JobDetail }) {

  const displayId   = job.job_order_code
  const prepStages  = job.stages.filter((s) => s.category_name?.toLowerCase() === "preparation")
  const instStages  = job.stages.filter((s) => s.category_name?.toLowerCase() === "installation")
  const finStages   = job.stages.filter((s) => s.category_name?.toLowerCase() === "finishing")
  const totalStages = job.stages.length
  const doneStages  = job.stages.filter((s) => s.status === "done").length
  const progress    = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/sales/job-orders"
            className="inline-flex items-center gap-1.5 text-sm text-body hover:text-heading mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Job Management
          </Link>
          <h1 className="text-xl font-bold text-heading">{displayId}</h1>
        </div>
        <StatusBadge status={job.status} className="mt-6 px-3 py-1 text-sm" />
      </div>

      {/* Read-only notice */}
      <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-card px-4 py-2.5 text-xs text-primary font-medium">
        <span>View only — modifications are handled by Operations.</span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Customer */}
        <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Customer</p>
          <InfoRow label="Name"    value={job.customer_name  || "—"} />
          <InfoRow label="Plate"   value={job.plate_number   || "—"} />
          <InfoRow label="Vehicle" value={job.vehicle_unit   || "—"} />
          <InfoRow label="Contact" value={job.contact_number || "—"} />
        </div>

        {/* Service + Timeline */}
        <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Service &amp; Timeline</p>
          <InfoRow label="Service"   value={job.service} />
          <InfoRow label="Scheduled" value={fmtDateTime(job.scheduled_at)} />
          <InfoRow label="Started"   value={fmtDateTime(job.actual_start_at)} />
          <InfoRow label="Est. End"  value={fmtDateTime(job.expected_completion_at)} />
          {job.finishing_approved_at && (
            <InfoRow label="Finishing Passed" value={fmtDateTime(job.finishing_approved_at)} />
          )}
        </div>

        {/* Team */}
        <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Team</p>
          <InfoRow label="Head Detailer"  value={job.head_detailer?.full_name  ?? "Unassigned"} />
          <InfoRow label="Head Installer" value={job.head_installer?.full_name ?? "Unassigned"} />
          {job.detailers.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1">Detailers</p>
              <ul className="space-y-0.5">
                {job.detailers.map((d) => (
                  <li key={d.id} className="text-sm text-body">{d.name}</li>
                ))}
              </ul>
            </div>
          )}
          {job.installers.length > 0 && (
            <div>
              <p className="text-xs text-muted mb-1">Installers</p>
              <ul className="space-y-0.5">
                {job.installers.map((i) => (
                  <li key={i.id} className="text-sm text-body">{i.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-2">
        <div className="flex justify-between text-xs font-medium text-body">
          <span>Overall Progress</span>
          <span>{doneStages} / {totalStages} stages · {progress}%</span>
        </div>
        <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progress === 100 ? "bg-status-inspection" : progress >= 50 ? "bg-primary" : "bg-status-total"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">Workflow Stages</p>

        {prepStages.length > 0 && (
          <SectionCollapse title="Preparation" count={prepStages.length} accent="text-primary">
            {prepStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {instStages.length > 0 && (
          <SectionCollapse title="Installation" count={instStages.length} accent="text-status-concern">
            {instStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {finStages.length > 0 && (
          <SectionCollapse title="Finishing" count={finStages.length} accent="text-status-inspection">
            {finStages.map((s) => <StageRow key={s.id} stage={s} />)}
          </SectionCollapse>
        )}

        {job.stages.length === 0 && (
          <p className="text-sm text-muted text-center py-6">No stages found for this job.</p>
        )}
      </div>

      {/* History */}
      {job.history.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-card p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Status History</p>
          <div className="flex flex-col gap-3">
            {job.history.map((h, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-border mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-heading">{h.status}</p>
                  <p className="text-xs text-muted">{fmtDateTime(h.created_at)} · {h.changed_by}</p>
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
        <span className="text-sm font-medium text-heading flex-1">
          {stage.sequence_order}. {stage.name}
        </span>
        <Badge className={cn("capitalize", statusStyle(stage.status).soft)}>
          {stage.status.replace("_", " ")}
        </Badge>
      </div>
      {stage.rework_instructions && (
        <p className="text-xs text-status-rework ml-6.5 bg-status-rework/10 rounded-sm px-2.5 py-1.5">
          Rework: {stage.rework_instructions}
        </p>
      )}
      {stage.completed_at && (
        <p className="text-[11px] text-status-inspection ml-6.5">✓ Done {stage.completed_at}</p>
      )}
      {stage.media.length > 0 && (
        <div className="flex gap-2 ml-6.5 flex-wrap mt-1">
          {stage.media.map((m) =>
            m.media_type === "photo" ? (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={m.file_url}
                  alt=""
                  className="w-12 h-12 rounded-sm object-cover border border-border hover:opacity-80 transition-opacity"
                />
              </a>
            ) : (
              <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 border border-primary/20 rounded-sm">
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
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-sm font-medium text-heading text-right">{value}</span>
    </div>
  )
}
