"use client"

import { useEffect, useRef, useState } from "react"
import { X, GripVertical, Trash2, Plus, Pencil } from "lucide-react"

interface Stage {
  id: string
  name: string
}

interface AddServiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const EMPTY_FORM = {
  serviceName: "",
  description: "",
  estimatedDays: "3",
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

function StageList({
  stages,
  errors,
  editingId,
  setEditingId,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  placeholder,
}: {
  stages: Stage[]
  errors: Record<string, string>
  editingId: string | null
  setEditingId: (id: string | null) => void
  onUpdate: (id: string, value: string) => void
  onRemove: (id: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      {stages.map((stage, index) => {
        const isEditing = editingId === stage.id
        return (
          <div
            key={stage.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className="flex items-center gap-2 group"
          >
            <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 shrink-0">
              <GripVertical className="w-4 h-4" />
            </div>
            <span className="text-sm text-gray-400 w-5 shrink-0 text-right">
              {index + 1}.
            </span>

            <div className="flex-1">
              {isEditing ? (
                <input
                  autoFocus
                  type="text"
                  value={stage.name}
                  onChange={(e) => onUpdate(stage.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null) }}
                  placeholder={placeholder}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                    errors[`stage_${stage.id}`] ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                />
              ) : (
                <div
                  className={`flex items-center justify-between px-3 py-2 text-sm border rounded-lg bg-gray-50 cursor-text ${
                    errors[`stage_${stage.id}`] ? "border-red-400" : "border-gray-200"
                  }`}
                  onClick={() => setEditingId(stage.id)}
                >
                  <span className={stage.name ? "text-gray-700" : "text-gray-400"}>
                    {stage.name || placeholder}
                  </span>
                  <Pencil className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-2" />
                </div>
              )}
              {errors[`stage_${stage.id}`] && (
                <p className="text-xs text-red-500 mt-0.5">{errors[`stage_${stage.id}`]}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onRemove(stage.id)}
              className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function AddServiceModal({ open, onClose, onSuccess }: AddServiceModalProps) {
  const [form, setForm]                     = useState(EMPTY_FORM)
  const [detailerStages, setDetailerStages] = useState<Stage[]>([])
  const [installerStages, setInstallerStages] = useState<Stage[]>([])
  const [editingId, setEditingId]           = useState<string | null>(null)
  const [errors, setErrors]                 = useState<Record<string, string>>({})
  const [serverError, setServerError]       = useState("")
  const [submitting, setSubmitting]         = useState(false)

  const detailerDragIndex = useRef<number | null>(null)
  const installerDragIndex = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setDetailerStages([])
      setInstallerStages([])
      setEditingId(null)
      setErrors({})
      setServerError("")
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined as unknown as string }))
  }

  function addDetailerStage() {
    const id = makeId()
    setDetailerStages((p) => [...p, { id, name: "" }])
    setEditingId(id)
  }

  function addInstallerStage() {
    const id = makeId()
    setInstallerStages((p) => [...p, { id, name: "" }])
    setEditingId(id)
  }

  function updateStage(list: "detailer" | "installer", id: string, value: string) {
    const setter = list === "detailer" ? setDetailerStages : setInstallerStages
    setter((p) => p.map((s) => (s.id === id ? { ...s, name: value } : s)))
    setErrors((p) => ({ ...p, [`stage_${id}`]: undefined as unknown as string }))
  }

  function removeStage(list: "detailer" | "installer", id: string) {
    const setter = list === "detailer" ? setDetailerStages : setInstallerStages
    setter((p) => p.filter((s) => s.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function makeDragHandlers(
    list: "detailer" | "installer",
    dragIndex: React.RefObject<number | null>
  ) {
    const setter = list === "detailer" ? setDetailerStages : setInstallerStages
    return {
      onDragStart: (index: number) => { dragIndex.current = index },
      onDragOver:  (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (dragIndex.current === null || dragIndex.current === index) return
        setter((prev) => {
          const next = [...prev]
          const [moved] = next.splice(dragIndex.current!, 1)
          next.splice(index, 0, moved)
          dragIndex.current = index
          return next
        })
      },
      onDragEnd: () => { dragIndex.current = null },
    }
  }

  const detailerDnd  = makeDragHandlers("detailer", detailerDragIndex)
  const installerDnd = makeDragHandlers("installer", installerDragIndex)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.serviceName.trim()) e.serviceName = "Service name is required."
    if (!form.estimatedDays.trim()) e.estimatedDays = "Duration is required."
    else if (isNaN(Number(form.estimatedDays)) || Number(form.estimatedDays) < 1)
      e.estimatedDays = "Enter a valid number of days (minimum 1)."
    ;[...detailerStages, ...installerStages].forEach((s) => {
      if (!s.name.trim()) e[`stage_${s.id}`] = "Stage name cannot be empty."
    })
    return e
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setServerError("")
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setSubmitting(true)
    try {
      const allStages = [
        ...detailerStages.map((s, i) => ({ name: s.name.trim(), category: "preparation", sequence_order: i + 1 })),
        ...installerStages.map((s, i) => ({ name: s.name.trim(), category: "installation", sequence_order: i + 1 })),
      ]
      const res = await fetch("/api/admin/create-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName:             form.serviceName.trim(),
          description:             form.description.trim(),
          estimatedDurationMins:   Number(form.estimatedDays) * 24 * 60,
          stages:                  allStages,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? "Something went wrong.")
        return
      }
      onSuccess()
      onClose()
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-[540px] bg-white z-50 shadow-2xl flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">Add New Service</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {serverError}
            </div>
          )}

          {/* Service Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.serviceName}
              onChange={(e) => setField("serviceName", e.target.value)}
              placeholder="e.g. Full Detail Package"
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                errors.serviceName ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
            />
            {errors.serviceName && <p className="text-xs text-red-500">{errors.serviceName}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              placeholder="Optional — describe what this service includes."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors resize-none"
            />
          </div>

          {/* Estimated Duration */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Estimated Duration <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={form.estimatedDays}
                onChange={(e) => setField("estimatedDays", e.target.value)}
                className={`w-28 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  errors.estimatedDays ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              />
              <span className="text-sm text-gray-500">days</span>
            </div>
            {errors.estimatedDays && <p className="text-xs text-red-500">{errors.estimatedDays}</p>}
            <p className="text-xs text-gray-400">
              Used to automatically calculate the job timeline when a job order is created.
            </p>
          </div>

          {/* Workflow Stages */}
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Workflow Stages</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Define sequential stages for each team. Drag to reorder within each section.
              </p>
            </div>

            {/* Detailers Section */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide bg-blue-50 px-2.5 py-1 rounded-full">
                  Preparation Team (Detailers)
                </span>
              </div>

              <StageList
                stages={detailerStages}
                errors={errors}
                editingId={editingId}
                setEditingId={setEditingId}
                onUpdate={(id, val) => updateStage("detailer", id, val)}
                onRemove={(id) => removeStage("detailer", id)}
                onDragStart={detailerDnd.onDragStart}
                onDragOver={detailerDnd.onDragOver}
                onDragEnd={detailerDnd.onDragEnd}
                placeholder="Stage name (e.g. Wash & Dry)"
              />

              {detailerStages.length === 0 && (
                <p className="text-xs text-gray-400 italic">No stages added yet.</p>
              )}

              <button
                type="button"
                onClick={addDetailerStage}
                className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100" />

            {/* Installers Section */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide bg-purple-50 px-2.5 py-1 rounded-full">
                  Installation Team (Installers)
                </span>
              </div>

              <StageList
                stages={installerStages}
                errors={errors}
                editingId={editingId}
                setEditingId={setEditingId}
                onUpdate={(id, val) => updateStage("installer", id, val)}
                onRemove={(id) => removeStage("installer", id)}
                onDragStart={installerDnd.onDragStart}
                onDragOver={installerDnd.onDragOver}
                onDragEnd={installerDnd.onDragEnd}
                placeholder="Stage name (e.g. PPF Application)"
              />

              {installerStages.length === 0 && (
                <p className="text-xs text-gray-400 italic">No stages added yet.</p>
              )}

              <button
                type="button"
                onClick={addInstallerStage}
                className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Stage
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            <span className="text-red-500">*</span> Required field
          </p>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Service"}
          </button>
        </div>
      </div>
    </>
  )
}
