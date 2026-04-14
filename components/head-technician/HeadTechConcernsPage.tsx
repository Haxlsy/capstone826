"use client"

import { useState, useEffect, useRef } from "react"
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
  AlertCircle,
} from "lucide-react"
import { BottomNav } from "./components/BottomNav"

// ── Types ─────────────────────────────────────────────────────────────────────
type Concern = {
  id: string
  title: string
  description: string
  status: "Pending" | "Resolved"
  response_note: string | null
  submitted_at: string
  media: { url: string; type: string }[]
}

// ── Expandable concern card ───────────────────────────────────────────────────
function ConcernCard({ concern }: { concern: Concern }) {
  const [open, setOpen] = useState(false)
  const isPending = concern.status === "Pending"

  return (
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
        </div>

        <div className="shrink-0 text-gray-300 mt-0.5">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
          <p className="text-sm text-gray-600 leading-relaxed">{concern.description}</p>

          {concern.media.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Paperclip size={12} />
              <span>{concern.media.length} attachment{concern.media.length !== 1 ? "s" : ""}</span>
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
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HeadTechConcernsPage() {
  const [concerns, setConcerns]   = useState<Concern[]>([])
  const [loading, setLoading]     = useState(true)

  const [title, setTitle]             = useState("")
  const [description, setDescription] = useState("")
  const [mediaFile, setMediaFile]     = useState<File | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)
  const [submitted, setSubmitted]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!title.trim())       { setFormError("Title is required."); return }
    if (!description.trim()) { setFormError("Description is required."); return }

    setSubmitting(true)
    try {
      const res  = await fetch("/api/head-technician/concerns", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), description: description.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setFormError(json.error ?? "Submission failed."); return }

      setTitle("")
      setDescription("")
      setMediaFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setSubmitted((v) => !v)
    } catch {
      setFormError("Network error. Please try again.")
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
            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFormError(null) }}
                placeholder="e.g. Equipment not working"
                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setFormError(null) }}
                placeholder="Describe the issue in detail…"
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-3 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Attachment */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600">
                Attachment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {mediaFile ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3">
                  <Paperclip size={14} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{mediaFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setMediaFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                    className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-3.5 py-3 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                >
                  <Paperclip size={14} />
                  Attach photo or video
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Error message */}
            {formError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="text-red-400 shrink-0" />
                <p className="text-xs text-red-500">{formError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit to Operations"}
              {!submitting && <Send size={14} />}
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
