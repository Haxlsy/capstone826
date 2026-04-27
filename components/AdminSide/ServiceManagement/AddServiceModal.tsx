"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Plus, Clock } from "lucide-react"
import {
  ServiceTypeCombobox,
  StageList,
  AddCategoryDropdown,
  CreateCategoryForm,
  colorStyles,
  makeId,
  minsToHHMM,
  sumStageDurations,
  type WorkflowCategory,
  type CategorySection,
} from "./service-form-helpers"

interface AddServiceModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const EMPTY_FORM = {
  serviceType: "",
  serviceName: "",
  description: "",
}

export default function AddServiceModal({ open, onClose, onSuccess }: AddServiceModalProps) {
  const [form, setForm]                         = useState(EMPTY_FORM)
  const [globalCategories, setGlobalCategories] = useState<WorkflowCategory[]>([])
  const [serviceTypes, setServiceTypes]         = useState<string[]>([])
  const [sections, setSections]                 = useState<CategorySection[]>([])
  const [editingId, setEditingId]               = useState<string | null>(null)
  const [errors, setErrors]                     = useState<Record<string, string>>({})
  const [serverError, setServerError]           = useState("")
  const [submitting, setSubmitting]             = useState(false)
  const [showCreateForm, setShowCreateForm]     = useState(false)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [createCategoryError, setCreateCategoryError] = useState("")

  useEffect(() => {
    if (!open) return
    setForm(EMPTY_FORM)
    setSections([])
    setEditingId(null)
    setErrors({})
    setServerError("")
    setShowCreateForm(false)

    fetch("/api/admin/workflow-categories")
      .then((r) => r.json())
      .then((json) => { if (json.categories) setGlobalCategories(json.categories) })
      .catch(() => {})

    fetch("/api/admin/service-types")
      .then((r) => r.json())
      .then((json) => { if (Array.isArray(json.types)) setServiceTypes(json.types) })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined as unknown as string }))
  }

  // ── Section management ──────────────────────────────────────────
  function addSection(cat: WorkflowCategory) {
    setSections((prev) => [
      ...prev,
      {
        categoryId:     cat.id,
        categoryName:   cat.name,
        technicianRole: cat.technician_role,
        displayColor:   cat.display_color,
        stages:         [],
        dragIndex:      { current: null },
      },
    ])
    if (errors.sections) setErrors((p) => ({ ...p, sections: undefined as unknown as string }))
  }

  function removeSection(categoryId: string) {
    setSections((prev) => prev.filter((s) => s.categoryId !== categoryId))
  }

  async function handleCreateCategory(name: string, role: "detailer" | "installer", color: string) {
    setCreatingCategory(true)
    setCreateCategoryError("")
    try {
      const res  = await fetch("/api/admin/workflow-categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, technician_role: role, display_color: color }),
      })
      const json = await res.json()
      if (!res.ok) { setCreateCategoryError(json.error ?? "Failed to create category."); return }
      const newCat: WorkflowCategory = json.category
      setGlobalCategories((prev) => [...prev, newCat])
      addSection(newCat)
      setShowCreateForm(false)
    } catch {
      setCreateCategoryError("Network error. Please try again.")
    } finally {
      setCreatingCategory(false)
    }
  }

  // ── Stage management ────────────────────────────────────────────
  function addStage(categoryId: string) {
    const id = makeId()
    setSections((prev) =>
      prev.map((sec) =>
        sec.categoryId === categoryId
          ? { ...sec, stages: [...sec.stages, { id, name: "", stage_duration_mins: 0 }] }
          : sec
      )
    )
    setEditingId(id)
  }

  function updateStage(categoryId: string, stageId: string, value: string) {
    setSections((prev) =>
      prev.map((sec) =>
        sec.categoryId === categoryId
          ? { ...sec, stages: sec.stages.map((s) => s.id === stageId ? { ...s, name: value } : s) }
          : sec
      )
    )
    setErrors((p) => ({ ...p, [`stage_${stageId}`]: undefined as unknown as string }))
  }

  function updateStageDuration(categoryId: string, stageId: string, mins: number) {
    setSections((prev) =>
      prev.map((sec) =>
        sec.categoryId === categoryId
          ? { ...sec, stages: sec.stages.map((s) => s.id === stageId ? { ...s, stage_duration_mins: mins } : s) }
          : sec
      )
    )
    setErrors((p) => ({ ...p, [`dur_${stageId}`]: undefined as unknown as string }))
  }

  function removeStage(categoryId: string, stageId: string) {
    setSections((prev) =>
      prev.map((sec) =>
        sec.categoryId === categoryId
          ? { ...sec, stages: sec.stages.filter((s) => s.id !== stageId) }
          : sec
      )
    )
    if (editingId === stageId) setEditingId(null)
  }

  const totalDurationMins = useMemo(
    () => sumStageDurations(sections.flatMap((s) => s.stages)),
    [sections]
  )

  function makeDragHandlers(categoryId: string, dragIndex: React.MutableRefObject<number | null>) {
    return {
      onDragStart: (index: number) => { dragIndex.current = index },
      onDragOver:  (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (dragIndex.current === null || dragIndex.current === index) return
        setSections((prev) =>
          prev.map((sec) => {
            if (sec.categoryId !== categoryId) return sec
            const next = [...sec.stages]
            const [moved] = next.splice(dragIndex.current!, 1)
            next.splice(index, 0, moved)
            dragIndex.current = index
            return { ...sec, stages: next }
          })
        )
      },
      onDragEnd: () => { dragIndex.current = null },
    }
  }

  // ── Validation ──────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!form.serviceType) e.serviceType = "Service type is required."
    if (!form.serviceName.trim()) e.serviceName = "Service name is required."
    if (sections.length === 0) e.sections = "At least 1 category section is required."
    sections.forEach((sec) => {
      if (sec.stages.length === 0)
        e[`section_${sec.categoryId}`] = `At least 1 stage is required in "${sec.categoryName}".`
      sec.stages.forEach((s) => {
        if (!s.name.trim()) e[`stage_${s.id}`] = "Stage name cannot be empty."
        if ((s.stage_duration_mins ?? 0) < 1) e[`dur_${s.id}`] = "Duration must be at least 1 minute."
      })
    })
    return e
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    setServerError("")
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSubmitting(true)
    try {
      let seq = 1
      const allStages = sections.flatMap((sec) =>
        sec.stages.map((s) => ({
          name:               s.name.trim(),
          category_id:        sec.categoryId,
          sequence_order:     seq++,
          stage_duration_mins: s.stage_duration_mins,
        }))
      )
      const res = await fetch("/api/admin/create-service", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType:  form.serviceType,
          serviceName:  form.serviceName.trim(),
          description:  form.description.trim(),
          stages:       allStages,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setServerError(json.error ?? "Something went wrong."); return }
      onSuccess()
      onClose()
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const usedCategoryIds = new Set(sections.map((s) => s.categoryId))

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

          {/* Service Type */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Service Type <span className="text-red-500">*</span>
            </label>
            <ServiceTypeCombobox
              value={form.serviceType}
              serviceTypes={serviceTypes}
              onChange={(v) => {
                setForm((p) => ({ ...p, serviceType: v }))
                if (errors.serviceType) setErrors((p) => ({ ...p, serviceType: undefined as unknown as string }))
              }}
              error={errors.serviceType}
            />
          </div>

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

          {/* Estimated Duration — computed from stage durations */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Estimated Duration</label>
            <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-700">
                {minsToHHMM(totalDurationMins)}
              </span>
              <span className="text-xs text-gray-400">HH : MM</span>
            </div>
            <p className="text-xs text-gray-400">
              Auto-calculated from the sum of all stage durations below.
            </p>
          </div>

          {/* Workflow Stages */}
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Workflow Stages</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Add category sections, then define stages within each. Drag to reorder stages.
              </p>
            </div>

            {errors.sections && <p className="text-xs text-red-500">{errors.sections}</p>}
            {sections.length === 0 && !errors.sections && (
              <p className="text-xs text-gray-400 italic">No category sections added yet.</p>
            )}

            {sections.map((sec, secIdx) => {
              const styles = colorStyles(sec.displayColor)
              const dnd    = makeDragHandlers(sec.categoryId, sec.dragIndex)
              return (
                <div key={sec.categoryId}>
                  {secIdx > 0 && <div className="border-t border-gray-100 mb-5" />}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                        errors[`section_${sec.categoryId}`] ? "text-red-700 bg-red-50" : styles.badge
                      }`}>
                        {sec.categoryName}
                        <span className="ml-1 font-normal normal-case opacity-60">({sec.technicianRole}s)</span>
                        <span className="text-red-500 ml-0.5">*</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSection(sec.categoryId)}
                        className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                        title="Remove section"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <StageList
                      stages={sec.stages}
                      errors={errors}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      onUpdate={(id, val) => updateStage(sec.categoryId, id, val)}
                      onUpdateDuration={(id, mins) => updateStageDuration(sec.categoryId, id, mins)}
                      onRemove={(id) => removeStage(sec.categoryId, id)}
                      onDragStart={dnd.onDragStart}
                      onDragOver={dnd.onDragOver}
                      onDragEnd={dnd.onDragEnd}
                      placeholder="Stage name"
                    />
                    {sec.stages.length === 0 && !errors[`section_${sec.categoryId}`] && (
                      <p className="text-xs text-gray-400 italic">No stages added yet.</p>
                    )}
                    {errors[`section_${sec.categoryId}`] && (
                      <p className="text-xs text-red-500">{errors[`section_${sec.categoryId}`]}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => addStage(sec.categoryId)}
                      className={`flex items-center gap-1 text-sm font-medium transition-colors ${styles.button}`}
                    >
                      <Plus className="w-4 h-4" />
                      Add Stage
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="space-y-3 pt-1">
              {showCreateForm ? (
                <CreateCategoryForm
                  onSubmit={handleCreateCategory}
                  onCancel={() => { setShowCreateForm(false); setCreateCategoryError("") }}
                  submitting={creatingCategory}
                  error={createCategoryError}
                />
              ) : (
                <AddCategoryDropdown
                  globalCategories={globalCategories}
                  usedCategoryIds={usedCategoryIds}
                  onSelect={addSection}
                  onCreateNew={() => setShowCreateForm(true)}
                />
              )}
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
