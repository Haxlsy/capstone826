"use client"

import { useEffect, useRef, useState } from "react"
import { X, GripVertical, Trash2, Plus } from "lucide-react"

type StageCategory = "preparation" | "installation"

interface Stage {
  id: string
  name: string
  category: StageCategory
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

export default function AddServiceModal({
  open,
  onClose,
  onSuccess,
}: AddServiceModalProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [stages, setStages] = useState<Stage[]>([])
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [serverError, setServerError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // DnD state
  const dragIndex = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setStages([])
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
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }))
  }

  function addStage() {
    setStages((p) => [...p, { id: makeId(), name: "", category: "preparation" }])
  }

  function removeStage(id: string) {
    setStages((p) => p.filter((s) => s.id !== id))
  }

  function updateStage(id: string, field: "name" | "category", value: string) {
    setStages((p) =>
      p.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
    setErrors((p) => ({ ...p, [`stage_${id}`]: undefined }))
  }

  // Native HTML5 DnD handlers
  function onDragStart(index: number) {
    dragIndex.current = index
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex.current === null || dragIndex.current === index) return
    setStages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex.current!, 1)
      next.splice(index, 0, moved)
      dragIndex.current = index
      return next
    })
  }

  function onDragEnd() {
    dragIndex.current = null
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.serviceName.trim()) e.serviceName = "Service name is required."
    if (!form.estimatedDays.trim()) e.estimatedDays = "Duration is required."
    else if (isNaN(Number(form.estimatedDays)) || Number(form.estimatedDays) < 1)
      e.estimatedDays = "Enter a valid number of days (minimum 1)."
    stages.forEach((s) => {
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
      const res = await fetch("/api/admin/create-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceName: form.serviceName.trim(),
          description: form.description.trim(),
          estimatedDurationMins: Number(form.estimatedDays) * 24 * 60,
          stages: stages.map((s, i) => ({
            name: s.name.trim(),
            category: s.category,
            sequence_order: i + 1,
          })),
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
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[520px] bg-white z-50 shadow-2xl flex flex-col
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
            {errors.serviceName && (
              <p className="text-xs text-red-500">{errors.serviceName}</p>
            )}
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
            {errors.estimatedDays && (
              <p className="text-xs text-red-500">{errors.estimatedDays}</p>
            )}
            <p className="text-xs text-gray-400">
              Used to automatically calculate the job timeline when a job order is created.
            </p>
          </div>

          {/* Workflow Stages */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Workflow Stages</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Define the sequential stages for this service. Each stage is assigned to either
                the preparation (detailing) or installation team.
              </p>
            </div>

            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div
                  key={stage.id}
                  draggable
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDragEnd={onDragEnd}
                  className="flex items-start gap-2 group"
                >
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 shrink-0 mt-2.5">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Number */}
                  <span className="text-sm text-gray-400 w-5 shrink-0 text-right mt-2.5">
                    {index + 1}.
                  </span>

                  {/* Stage name + category */}
                  <div className="flex-1 flex flex-col gap-1.5">
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => updateStage(stage.id, "name", e.target.value)}
                      placeholder={`Stage ${index + 1} name`}
                      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                        errors[`stage_${stage.id}`]
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200"
                      }`}
                    />
                    <select
                      value={stage.category}
                      onChange={(e) =>
                        updateStage(stage.id, "category", e.target.value)
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors bg-white"
                    >
                      <option value="preparation">Preparation (Detailing team)</option>
                      <option value="installation">Installation (Installer team)</option>
                    </select>
                    {errors[`stage_${stage.id}`] && (
                      <p className="text-xs text-red-500">{errors[`stage_${stage.id}`]}</p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeStage(stage.id)}
                    className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors mt-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addStage}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </button>
          </div>

          {/* Required field legend */}
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
