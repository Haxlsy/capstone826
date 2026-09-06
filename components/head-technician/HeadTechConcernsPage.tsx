"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useTechnicianJobs } from "@/hooks/use-technician-jobs"
import {
  TriangleAlert,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Send,
  X,
  MessageSquareText,
  ImagePlus,
  Video,
  Loader2,
  Play,
  Briefcase,
  Layers,
  Search,
} from "lucide-react"
import { BottomNav } from "./components/BottomNav"
import { StatCard } from "@/components/ui/StatCard"
import { StatusBadge } from "@/components/ui/Badge"
import { useToast } from "@/components/ui/Toast"
import { MediaPreviewModal } from "@/components/ui/Modal"

// ── Types ─────────────────────────────────────────────────────────────────────
type ConcernMedia = { id: string; url: string; type: string }

type Concern = {
  id:             string
  title:          string
  description:    string
  status:         "Pending" | "Resolved"
  response_note:  string | null
  submitted_at:   string
  job_display_id: string | null
  stage_name:     string | null
  media:          ConcernMedia[]
}

type JobOption   = { raw_id: string; label: string }
type StageOption = { id: string; label: string }

type FieldErrors = {
  job?:         string
  stage?:       string
  description?: string
}

function InlineError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-[11px] text-status-delayed mt-1 px-0.5">{msg}</p>
}

// ── Expandable concern card ───────────────────────────────────────────────────
function ConcernCard({ concern }: { concern: Concern }) {
  const [open, setOpen]       = useState(false)
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null)
  const isPending = concern.status === "Pending"

  return (
    <>
      <div className={`bg-surface rounded-card overflow-hidden border transition-colors duration-150 ${
        open ? "border-border shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]" : "border-border-subtle"
      }`}>
        {/* Header row — always visible */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-start gap-3 px-4 py-4 text-left"
        >
          <div className="mt-0.5 shrink-0">
            {isPending
              ? <Clock size={17} className="text-status-warning" />
              : <CheckCircle2 size={17} className="text-status-inspection" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-heading truncate">{concern.title}</p>
              <StatusBadge status={concern.status} className="shrink-0 text-[11px]" />
            </div>
            <p className="text-[11px] text-muted mt-0.5 font-medium">{concern.submitted_at}</p>

            {/* Job / Stage tags */}
            {(concern.job_display_id || concern.stage_name) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {concern.job_display_id && (
                  <span className="text-[10px] font-mono font-semibold bg-surface-muted text-body px-2 py-0.5 rounded-full">
                    {concern.job_display_id}
                  </span>
                )}
                {concern.stage_name && (
                  <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {concern.stage_name}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 text-muted mt-0.5">
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {/* Expanded detail */}
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-border-subtle pt-3">
            <p className="text-sm text-body leading-relaxed">{concern.description}</p>

            {/* Media thumbnails */}
            {concern.media.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {concern.media.map((m) =>
                    m.type === "video" ? (
                      <button
                        aria-label="Preview video attachment"
                        key={m.id}
                        onClick={() => setPreview({ url: m.url, type: m.type })}
                        className="w-16 h-16 rounded-card bg-surface-muted flex items-center justify-center border border-border"
                      >
                        <Play size={20} className="text-body" />
                      </button>
                    ) : (
                      <button
                        aria-label="Preview photo attachment"
                        key={m.id}
                        onClick={() => setPreview({ url: m.url, type: m.type })}
                        className="w-16 h-16 rounded-card overflow-hidden border border-border"
                      >
                        <img
                          src={m.url}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                        />
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {concern.response_note && (
              <div className="bg-primary/10 border border-primary/20 rounded-card p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MessageSquareText size={13} className="text-primary" />
                  <span className="text-xs font-semibold text-primary">Operations Response</span>
                </div>
                <p className="text-sm text-primary-hover leading-relaxed">{concern.response_note}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <MediaPreviewModal media={preview} onClose={() => setPreview(null)} />
    </>
  )
}

const INPUT_CLS = (err?: string) =>
  `w-full text-sm border rounded-card px-3.5 py-3 bg-surface-subtle text-heading focus:outline-none focus:ring-2 focus:border-transparent transition ${
    err ? "border-status-delayed/40 focus:ring-status-delayed/30" : "border-border focus:ring-primary/20"
  }`

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HeadTechConcernsPage() {
  const toast = useToast()
  const searchParams = useSearchParams()
  const [concerns, setConcerns] = useState<Concern[]>([])
  const [loading, setLoading]   = useState(true)

  const [description, setDescription] = useState("")
  const [mediaFiles, setMediaFiles]   = useState<File[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted]     = useState(false)

  // Job searchable combobox — cached via React Query so bouncing between
  // Jobs and Concerns doesn't re-run the whole jobs pipeline every visit.
  const { data: technicianJobsData } = useTechnicianJobs()
  const userRole = (technicianJobsData?.userRole ?? "") as "head_detailer" | "head_installer" | ""
  const jobs = useMemo<JobOption[]>(
    () =>
      (technicianJobsData?.jobs ?? [])
        .filter((j) => j.status !== "Released" && j.status !== "Cancelled")
        .map((j) => ({
          raw_id: j.raw_id,
          label:  `${j.job_id} · ${j.plate_number}${j.service ? ` · ${j.service}` : ""}`,
        })),
    [technicianJobsData],
  )
  const [jobSearch, setJobSearch]     = useState("")
  const [jobDropOpen, setJobDropOpen] = useState(false)
  const [selectedJobId, setSelectedJobId]   = useState("")
  const [selectedJobLabel, setSelectedJobLabel] = useState("")

  // Stage dropdown
  const [stages, setStages]                   = useState<StageOption[]>([])
  const [stagesLoading, setStagesLoading]     = useState(false)
  const [selectedStageId, setSelectedStageId] = useState("")

  const photoInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef  = useRef<HTMLInputElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((j) => j.label.toLowerCase().includes(q))
  }, [jobSearch, jobs])

  // Load concerns
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res  = await fetch("/api/head-technician/concerns")
        const json = await res.json()
        if (res.ok) setConcerns(json.concerns ?? [])
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [submitted])

  // Pre-fill the job combobox when arriving via a "Report Concern" deep link
  // (e.g. /head-technician/concerns?jobOrderId=<raw_id>).
  useEffect(() => {
    const jobOrderId = searchParams.get("jobOrderId")
    if (!jobOrderId || jobs.length === 0) return
    const match = jobs.find((j) => j.raw_id === jobOrderId)
    if (match) {
      setSelectedJobId(match.raw_id)
      setSelectedJobLabel(match.label)
    }
  }, [searchParams, jobs])

  // Load stages when a job is selected
  useEffect(() => {
    setSelectedStageId("")
    if (!selectedJobId) {
      setStages([])
      return
    }
    setStagesLoading(true)
    async function loadStages() {
      try {
        const res  = await fetch(`/api/head-technician/jobs/${selectedJobId}`)
        const json = await res.json()
        if (!res.ok) return
        const allowedRole = userRole === "head_installer" ? "installer" : "detailer"
        const stageList: StageOption[] = (json.job?.stages ?? [])
          .filter((s: any) => s.category_role === allowedRole)
          .map((s: any) => ({
            id:    s.id as string,
            label: `${s.category} · ${s.order}. ${s.name}`,
          }))
        setStages(stageList)
      } catch {
        setStages([])
      } finally {
        setStagesLoading(false)
      }
    }
    loadStages()
  }, [selectedJobId])

  function addFiles(incoming: FileList | null) {
    if (!incoming) return
    const next = Array.from(incoming).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    )
    setMediaFiles((prev) => [...prev, ...next])
  }

  function removeFile(idx: number) {
    setMediaFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()

    // Inline validation
    const errs: FieldErrors = {}
    if (!selectedJobId)       errs.job         = "Please select a job."
    if (!description.trim())  errs.description = "Description is required."
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})

    setSubmitting(true)
    try {
      // Step 1: create the concern record (title is auto-generated server-side)
      const res  = await fetch("/api/head-technician/concerns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          description: description.trim(),
          job_order_id: selectedJobId,
          ...(selectedStageId ? { stage_id: selectedStageId } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) { setFieldErrors({ job: json.error ?? "Submission failed." }); return }

      const concernId = json.id as string

      // Step 2: upload each media file sequentially
      const uploadErrors: string[] = []
      for (const file of mediaFiles) {
        const form = new FormData()
        form.append("file", file)
        try {
          const uploadRes  = await fetch(`/api/head-technician/concerns/${concernId}/media`, {
            method: "POST",
            body:   form,
          })
          const uploadJson = await uploadRes.json()
          if (!uploadRes.ok) uploadErrors.push(uploadJson?.error ?? `Failed to upload ${file.name}`)
        } catch {
          uploadErrors.push(`Failed to upload ${file.name}`)
        }
      }

      // Reset form
      setDescription("")
      setMediaFiles([])
      setJobSearch("")
      setSelectedJobId("")
      setSelectedJobLabel("")
      setSelectedStageId("")
      setStages([])
      setSubmitted((v) => !v)

      if (uploadErrors.length > 0) {
        setFieldErrors({ description: `Concern submitted, but ${uploadErrors.length} file(s) failed: ${uploadErrors.join("; ")}` })
      } else {
        toast.success("Concern submitted to Operations.")
      }
    } catch {
      setFieldErrors({ description: "Network error. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  const pendingCount  = concerns.filter((c) => c.status === "Pending").length
  const resolvedCount = concerns.filter((c) => c.status === "Resolved").length

  return (
    <>
      <main className="px-4 pt-6 pb-28 max-w-md mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-card bg-status-warning/10 flex items-center justify-center shrink-0">
            <TriangleAlert size={17} className="text-status-warning" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-heading leading-tight tracking-tight">Concerns</h1>
            <p className="text-xs text-muted font-medium mt-0.5">Report issues to Operations</p>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────── */}
        {!loading && concerns.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Pending" value={pendingCount} icon={Clock} tone="pending" />
            <StatCard label="Resolved" value={resolvedCount} icon={CheckCircle2} tone="inspection" />
          </div>
        )}

        {/* ── Submit form ──────────────────────────────────────────── */}
        <div className="bg-surface rounded-card border border-border-subtle shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-4 space-y-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest">
            Submit New Concern
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Related Job — required, searchable combobox */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-body mb-1.5">
                <Briefcase size={11} className="text-muted" />
                Related Job <span className="text-status-delayed">*</span>
              </label>
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search job ID or plate…"
                  value={selectedJobId ? selectedJobLabel : jobSearch}
                  onFocus={() => { if (selectedJobId) { setJobSearch(""); setSelectedJobId(""); setSelectedJobLabel("") } setJobDropOpen(true) }}
                  onBlur={() => setTimeout(() => setJobDropOpen(false), 180)}
                  onChange={(e) => { setJobSearch(e.target.value); setJobDropOpen(true); setSelectedJobId(""); setSelectedJobLabel("") }}
                  className={`w-full text-sm rounded-card pl-9 pr-3.5 py-3 bg-surface-subtle focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    fieldErrors.job ? "border border-status-delayed/40 focus:ring-status-delayed/30" : "border border-border focus:ring-primary/20"
                  }`}
                />
                {/* Dropdown */}
                {jobDropOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-surface border border-border rounded-card shadow-pop overflow-hidden">
                    <div className="max-h-52 overflow-y-auto">
                      {filteredJobs.length > 0 ? filteredJobs.map((j) => (
                        <button
                          key={j.raw_id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedJobId(j.raw_id)
                            setSelectedJobLabel(j.label)
                            setJobSearch("")
                            setJobDropOpen(false)
                            setFieldErrors((prev) => ({ ...prev, job: undefined }))
                          }}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-primary/10 transition-colors border-b last:border-none border-border-subtle"
                        >
                          <span className="font-semibold text-heading text-xs">{j.label}</span>
                        </button>
                      )) : (
                        <div className="px-4 py-8 text-center text-sm text-muted">No matching jobs</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <InlineError msg={fieldErrors.job} />
            </div>

            {/* Related Stage (optional, appears after job is selected) */}
            {selectedJobId && (
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-body mb-1.5">
                  <Layers size={11} className="text-muted" />
                  Related Stage
                  <span className="text-muted font-normal ml-1">(optional)</span>
                </label>
                {stagesLoading ? (
                  <p className="text-xs text-muted px-1 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Loading stages…
                  </p>
                ) : (
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full text-sm border border-border rounded-card px-3.5 py-3 bg-surface-subtle text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition appearance-none"
                  >
                    <option value="">— Select a stage —</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-body mb-1.5">
                Description <span className="text-status-delayed">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setFieldErrors((p) => ({ ...p, description: undefined })) }}
                placeholder="Describe the issue in detail…"
                rows={4}
                className={INPUT_CLS(fieldErrors.description) + " placeholder:text-muted resize-none"}
              />
              <InlineError msg={fieldErrors.description} />
            </div>

            {/* Media attachments */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-body">
                Attachments <span className="text-muted font-normal">(optional)</span>
              </label>

              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.map((f, idx) => {
                    const isVideo = f.type.startsWith("video/")
                    const url     = URL.createObjectURL(f)
                    return (
                      <div key={idx} className="relative w-16 h-16">
                        {isVideo ? (
                          <div className="w-16 h-16 rounded-card bg-surface-muted flex items-center justify-center border border-border">
                            <Play size={18} className="text-body" />
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="w-16 h-16 rounded-card object-cover border border-border"
                          />
                        )}
                        <button
                          aria-label="Remove attachment"
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow"
                        >
                          <X size={9} className="text-white" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-border rounded-card py-2.5 text-body hover:bg-surface-muted cursor-pointer transition-colors">
                  <ImagePlus size={13} />
                  Photo
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-border rounded-card py-2.5 text-body hover:bg-surface-muted cursor-pointer transition-colors">
                  <Video size={13} />
                  Video
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-border rounded-card py-2.5 text-body hover:bg-surface-muted cursor-pointer transition-colors">
                  <Paperclip size={13} />
                  Attach
                  <input
                    ref={attachInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-card bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                : <><Send size={14} /> Submit to Operations</>
              }
            </button>
          </form>
        </div>

        {/* ── Concerns list ──────────────────────────────────────── */}
        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest px-0.5">
            My Concerns
          </p>

          {loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface rounded-card border border-border-subtle p-4 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-32 bg-surface-muted rounded-full" />
                    <div className="h-5 w-16 bg-surface-muted rounded-full" />
                  </div>
                  <div className="h-2.5 w-20 bg-surface-muted rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && concerns.length === 0 && (
            <div className="bg-surface rounded-card border border-border-subtle px-4 py-12 text-center space-y-1">
              <p className="text-sm font-medium text-body">No concerns yet</p>
              <p className="text-xs text-muted">Use the form above to report an issue.</p>
            </div>
          )}

          {!loading && concerns.map((c) => (
            <ConcernCard key={c.id} concern={c} />
          ))}
        </div>

      </main>

      <BottomNav active="concerns" />
    </>
  )
}
