"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
  return <p className="text-[11px] text-red-500 mt-1 px-0.5">{msg}</p>
}

// ── Expandable concern card ───────────────────────────────────────────────────
function ConcernCard({ concern }: { concern: Concern }) {
  const [open, setOpen]       = useState(false)
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null)
  const isPending = concern.status === "Pending"

  return (
    <>
      <div className={`bg-white rounded-2xl overflow-hidden border transition-colors duration-150 ${
        open ? "border-gray-200 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]" : "border-gray-100"
      }`}>
        {/* Header row — always visible */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-start gap-3 px-4 py-4 text-left"
        >
          <div className="mt-0.5 shrink-0">
            {isPending
              ? <Clock size={17} className="text-amber-500" />
              : <CheckCircle2 size={17} className="text-emerald-500" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 truncate">{concern.title}</p>
              <span className={`shrink-0 text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                isPending
                  ? "bg-amber-50 text-amber-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}>
                {concern.status}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{concern.submitted_at}</p>

            {/* Job / Stage tags */}
            {(concern.job_display_id || concern.stage_name) && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {concern.job_display_id && (
                  <span className="text-[10px] font-mono font-semibold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {concern.job_display_id}
                  </span>
                )}
                {concern.stage_name && (
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">
                    {concern.stage_name}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 text-gray-300 mt-0.5">
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {/* Expanded detail */}
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
            <p className="text-sm text-gray-600 leading-relaxed">{concern.description}</p>

            {/* Media thumbnails */}
            {concern.media.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {concern.media.map((m) =>
                    m.type === "video" ? (
                      <button
                        aria-label="Preview video attachment"
                        key={m.id}
                        onClick={() => setPreview({ url: m.url, type: m.type })}
                        className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-200"
                      >
                        <Play size={20} className="text-gray-500" />
                      </button>
                    ) : (
                      <button
                        aria-label="Preview photo attachment"
                        key={m.id}
                        onClick={() => setPreview({ url: m.url, type: m.type })}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200"
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
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <MessageSquareText size={13} className="text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600">Operations Response</span>
                </div>
                <p className="text-sm text-blue-800 leading-relaxed">{concern.response_note}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen media preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setPreview(null)}
        >
          <button
            aria-label="Close media preview"
            className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 rounded-full p-2.5"
            onClick={() => setPreview(null)}
          >
            <X size={20} />
          </button>
          {preview.type === "video" ? (
            <video
              src={preview.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={preview.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </>
  )
}

const INPUT_CLS = (err?: string) =>
  `w-full text-sm border rounded-xl px-3.5 py-3 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:border-transparent transition ${
    err ? "border-red-300 focus:ring-red-300" : "border-gray-200 focus:ring-gray-300"
  }`

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HeadTechConcernsPage() {
  const [concerns, setConcerns] = useState<Concern[]>([])
  const [loading, setLoading]   = useState(true)

  const [description, setDescription] = useState("")
  const [mediaFiles, setMediaFiles]   = useState<File[]>([])
  const [submitting, setSubmitting]   = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted]     = useState(false)

  // Job searchable combobox
  const [userRole, setUserRole]       = useState<"head_detailer" | "head_installer" | "">("")
  const [jobs, setJobs]               = useState<JobOption[]>([])
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

  // Load job list for dropdown
  useEffect(() => {
    async function loadJobs() {
      try {
        const res  = await fetch("/api/head-technician/jobs")
        const json = await res.json()
        if (!res.ok) return
        setUserRole(json.user_role ?? "")
        const mapped: JobOption[] = (json.jobs ?? [])
          .filter((j: any) => j.status !== "Released" && j.status !== "Cancelled")
          .map((j: any) => ({
            raw_id: j.raw_id as string,
            label:  `${j.job_id} · ${j.plate_number}${j.service ? ` · ${j.service}` : ""}`,
          }))
        setJobs(mapped)
      } catch {
        // leave empty
      }
    }
    loadJobs()
  }, [])

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
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <TriangleAlert size={17} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">Concerns</h1>
            <p className="text-xs text-gray-400 font-medium mt-0.5">Report issues to Operations</p>
          </div>
        </div>

        {/* ── Stat pills ─────────────────────────────────────────── */}
        {!loading && concerns.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-bold text-amber-600 leading-none">{pendingCount}</p>
              <p className="text-[11px] font-medium text-amber-500 mt-1">Pending</p>
            </div>
            <div className="bg-emerald-50 rounded-2xl px-3 py-3 text-center">
              <p className="text-xl font-bold text-emerald-600 leading-none">{resolvedCount}</p>
              <p className="text-[11px] font-medium text-emerald-500 mt-1">Resolved</p>
            </div>
          </div>
        )}

        {/* ── Submit form ──────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Submit New Concern
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">

            {/* Related Job — required, searchable combobox */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                <Briefcase size={11} className="text-gray-400" />
                Related Job <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search job ID or plate…"
                  value={selectedJobId ? selectedJobLabel : jobSearch}
                  onFocus={() => { if (selectedJobId) { setJobSearch(""); setSelectedJobId(""); setSelectedJobLabel("") } setJobDropOpen(true) }}
                  onBlur={() => setTimeout(() => setJobDropOpen(false), 180)}
                  onChange={(e) => { setJobSearch(e.target.value); setJobDropOpen(true); setSelectedJobId(""); setSelectedJobLabel("") }}
                  className={`w-full text-sm rounded-xl pl-9 pr-3.5 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent transition ${
                    fieldErrors.job ? "border border-red-300 focus:ring-red-300" : "border border-gray-200 focus:ring-gray-300"
                  }`}
                />
                {/* Dropdown */}
                {jobDropOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
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
                          className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50 transition-colors border-b last:border-none border-gray-50"
                        >
                          <span className="font-semibold text-gray-800 text-xs">{j.label}</span>
                        </button>
                      )) : (
                        <div className="px-4 py-8 text-center text-sm text-gray-400">No matching jobs</div>
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
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1.5">
                  <Layers size={11} className="text-gray-400" />
                  Related Stage
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                {stagesLoading ? (
                  <p className="text-xs text-gray-400 px-1 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Loading stages…
                  </p>
                ) : (
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 bg-gray-50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition appearance-none"
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
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setFieldErrors((p) => ({ ...p, description: undefined })) }}
                placeholder="Describe the issue in detail…"
                rows={4}
                className={INPUT_CLS(fieldErrors.description) + " placeholder-gray-400 resize-none"}
              />
              <InlineError msg={fieldErrors.description} />
            </div>

            {/* Media attachments */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-600">
                Attachments <span className="text-gray-400 font-normal">(optional)</span>
              </label>

              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.map((f, idx) => {
                    const isVideo = f.type.startsWith("video/")
                    const url     = URL.createObjectURL(f)
                    return (
                      <div key={idx} className="relative w-16 h-16">
                        {isVideo ? (
                          <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center border border-gray-200">
                            <Play size={18} className="text-gray-500" />
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover border border-gray-200"
                          />
                        )}
                        <button
                          aria-label="Remove attachment"
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center shadow"
                        >
                          <X size={9} className="text-white" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
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
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
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
                <label className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold border border-gray-200 rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
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
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-0.5">
            My Concerns
          </p>

          {loading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 w-32 bg-gray-100 rounded-full" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && concerns.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center space-y-1">
              <p className="text-sm font-medium text-gray-500">No concerns yet</p>
              <p className="text-xs text-gray-400">Use the form above to report an issue.</p>
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
