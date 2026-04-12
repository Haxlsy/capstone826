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

// ── Status styles ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  Pending:  "bg-amber-100 text-amber-700",
  Resolved: "bg-emerald-100 text-emerald-700",
}

// ── Expandable concern card ───────────────────────────────────────────────────
function ConcernCard({ concern }: { concern: Concern }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
      {/* Header row — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-4 text-left"
      >
        <div className="mt-0.5 shrink-0">
          {concern.status === "Resolved" ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : (
            <Clock size={18} className="text-amber-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{concern.title}</p>
            <span className={`shrink-0 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[concern.status] ?? "bg-gray-100 text-gray-600"}`}>
              {concern.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{concern.submitted_at}</p>
        </div>

        <div className="shrink-0 text-gray-300 mt-0.5">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
          <p className="text-sm text-gray-600 leading-relaxed pt-3">{concern.description}</p>

          {concern.media.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Paperclip size={12} />
              <span>{concern.media.length} attachment{concern.media.length !== 1 ? "s" : ""}</span>
            </div>
          )}

          {concern.response_note && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
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

  // Form state
  const [title, setTitle]             = useState("")
  const [description, setDescription] = useState("")
  const [mediaFile, setMediaFile]     = useState<File | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)
  const [submitted, setSubmitted]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load own concerns
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
  }, [submitted])  // re-fetch after a successful submit

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

      // Reset form and trigger re-fetch
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
      <main className="px-4 py-5 max-w-md mx-auto pb-28 space-y-6">

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <TriangleAlert size={18} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">Concerns</h1>
            <p className="text-xs text-gray-400">Report issues to Operations</p>
          </div>
        </div>

        {/* ── Submit form ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            New Concern
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFormError(null) }}
                placeholder="e.g. Equipment not working"
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); setFormError(null) }}
                placeholder="Describe the issue in detail..."
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition resize-none"
              />
            </div>

            {/* Optional media */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Attachment <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              {mediaFile ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <Paperclip size={14} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{mediaFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setMediaFile(null); if (fileInputRef.current) fileInputRef.current.value = "" }}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 border border-dashed border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-400 hover:border-gray-300 hover:text-gray-500 transition"
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

            {formError && (
              <p className="text-xs text-red-500">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting…" : "Submit to Operations"}
              {!submitting && <Send size={14} />}
            </button>
          </form>
        </div>

        {/* ── Stat pills ─────────────────────────────────────────────── */}
        {!loading && concerns.length > 0 && (
          <div className="flex gap-2">
            <div className="flex-1 bg-amber-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
              <p className="text-[11px] text-amber-500 font-medium">Pending</p>
            </div>
            <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-600">{resolvedCount}</p>
              <p className="text-[11px] text-emerald-500 font-medium">Resolved</p>
            </div>
          </div>
        )}

        {/* ── Concerns list ──────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">
            My Concerns
          </p>

          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          )}

          {!loading && concerns.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-8 text-center">
              <p className="text-sm text-gray-400">No concerns submitted yet.</p>
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
