"use client"

import { useState, useEffect } from "react"
import { Pencil, Trash2, Info, X } from "lucide-react"

const PLACEHOLDERS = [
  { tag: "[Customer Name]", description: "Customer's full name" },
  { tag: "[Sales Staff Name]", description: "Name of the assigned sales staff" },
  { tag: "[Plate Number]", description: "Vehicle plate number" },
  { tag: "[Car Model]", description: "Vehicle make and model" },
  { tag: "[Service Type]", description: "Type of service booked" },
]

const PLACEHOLDER_TAGS = PLACEHOLDERS.map((p) => p.tag)

interface Template {
  id: number
  title: string
  body: string
  modified: string
}

const initialTemplates: Template[] = [
  {
    id: 1,
    title: "Pickup Notification",
    body: "Hi [Customer Name], your [Car Model] with plate number [Plate Number] is ready for pickup at 826 Auto Care. Please bring a valid ID. Thank you!",
    modified: "Mar 28, 2026",
  },
  {
    id: 2,
    title: "Delay Notification",
    body: "Hi [Customer Name], we regret to inform you that your [Service Type] for your [Car Model] ([Plate Number]) has been delayed. We sincerely apologize for the inconvenience.",
    modified: "Mar 25, 2026",
  },
  {
    id: 3,
    title: "Booking Confirmation",
    body: "Hi [Customer Name], your booking for [Service Type] on your [Car Model] ([Plate Number]) has been confirmed. Our team, [Sales Staff Name], will assist you.",
    modified: "Mar 20, 2026",
  },
  {
    id: 4,
    title: "Payment Reminder",
    body: "Hi [Customer Name], this is a friendly reminder regarding the remaining balance for the [Service Type] service on your [Car Model] ([Plate Number]).",
    modified: "Mar 15, 2026",
  },
]

function highlightPlaceholders(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g)
  return parts.map((part, i) =>
    PLACEHOLDER_TAGS.includes(part) ? (
      <span key={i} className="text-orange-500 font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

function getTodayFormatted() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface ModalProps {
  template: Partial<Template> | null
  onClose: () => void
  onSave: (title: string, body: string) => void
}

function TemplateModal({ template, onClose, onSave }: ModalProps) {
  const [title, setTitle] = useState(template?.title ?? "")
  const [body, setBody] = useState(template?.body ?? "")

  function handleInsert(tag: string) {
    setBody((prev) => prev + tag)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">
            {template?.id ? "Edit Template" : "Add Template"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Template Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pickup Notification"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Message Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition resize-none"
            />
          </div>

          {/* Insert placeholders */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Insert Placeholder
            </p>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((p) => (
                <button
                  key={p.tag}
                  type="button"
                  onClick={() => handleInsert(p.tag)}
                  className="text-xs font-mono bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md hover:bg-blue-100 transition-colors"
                >
                  {p.tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (title.trim() && body.trim()) onSave(title.trim(), body.trim())
            }}
            className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [modal, setModal] = useState<Partial<Template> | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/operations/message-templates")
      .then((r) => r.json())
      .then((json) => {
        if (json.templates && json.templates.length > 0) {
          const dbTemplates: Template[] = json.templates.map((t: any) => ({
            id: t.template_id,
            title: t.template_name,
            body: t.body_text,
            modified: new Date(t.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            }),
          }))
          // Show DB templates first, keep mock data below
          setTemplates([...dbTemplates, ...initialTemplates])
        }
      })
      .catch(() => {
        // keep mock data on error
      })
  }, [])

  function openAdd() {
    setModal({})
  }

  function openEdit(t: Template) {
    setModal(t)
  }

  function handleSave(title: string, body: string) {
    if (modal?.id) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === modal.id ? { ...t, title, body, modified: getTodayFormatted() } : t
        )
      )
    } else {
      setTemplates((prev) => [
        ...prev,
        { id: Date.now(), title, body, modified: getTodayFormatted() },
      ])
    }
    setModal(null)
  }

  function handleDelete(id: number) {
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setDeleteId(null)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Message Templates</h1>
          <p className="text-sm text-gray-400 mt-1">
            Create and customize notification templates with dynamic placeholders.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-700 transition-colors shrink-0"
        >
          + Add Template
        </button>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-5">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow"
          >
            <h3 className="text-sm font-bold text-gray-800">{t.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed flex-1">
              {highlightPlaceholders(t.body)}
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">Modified: {t.modified}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(t)}
                  className="text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleteId(t.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Available Placeholders panel */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Available Placeholders</span>
          </div>
          <div className="space-y-3">
            {PLACEHOLDERS.map((p) => (
              <div key={p.tag} className="flex items-center gap-3">
                <code className="text-xs bg-blue-50 text-blue-600 font-mono px-2 py-0.5 rounded">
                  {p.tag}
                </code>
                <span className="text-sm text-gray-500">{p.description}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal !== null && (
        <TemplateModal
          template={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-bold text-gray-800 mb-2">Delete Template</h2>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this template? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
