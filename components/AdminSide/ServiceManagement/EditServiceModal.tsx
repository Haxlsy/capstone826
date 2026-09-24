"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { X, Plus, Clock } from "lucide-react"
import { Drawer } from "@/components/ui/Drawer"
import { Button } from "@/components/ui/Button"
import {
  ServiceTypeCombobox,
  StageList,
  AddCategoryDropdown,
  colorStyles,
  makeId,
  minsToHHMM,
  sumStageDurations,
  type CategorySection,
  type PresetItem,
} from "./service-form-helpers"

interface EditServiceModalProps {
  serviceId: string | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditServiceModal({ serviceId, open, onClose, onSuccess }: EditServiceModalProps) {
  // See AddServiceModal's identical comment — the error banner is at the top
  // of a long scrollable form; scroll it into view on a failed submit so a
  // duplicate-name (or any other) rejection is never off-screen.
  const topRef = useRef<HTMLDivElement>(null)
  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })

  const [serviceType,  setServiceType]  = useState("")
  const [serviceName,  setServiceName]  = useState("")
  const [description,  setDescription]  = useState("")

  const [serviceTypes, setServiceTypes]         = useState<string[]>([])
  const [sections, setSections]                 = useState<CategorySection[]>([])

  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState("")
  const [fetchError,  setFetchError]  = useState("")
  const [fetching,    setFetching]    = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  const [presets,     setPresets]     = useState<PresetItem[]>([])
  const [typeDeleteError,    setTypeDeleteError]    = useState("")
  const [typeDeleteAffected, setTypeDeleteAffected] = useState<string[]>([])
  const [typeDeleteLiveJobs, setTypeDeleteLiveJobs] = useState<string[]>([])
  const [saveWarning,        setSaveWarning]        = useState("")
  const [blockedStageNames,  setBlockedStageNames]  = useState<string[]>([])

  useEffect(() => {
    if (!open || !serviceId) return

    setFetching(true)
    setFetchError("")
    setServerError("")
    setErrors({})
    setEditingId(null)

    // Fetch service types, service data, and presets in parallel
    Promise.all([
      fetch("/api/admin/service-types").then((r) => r.json()),
      fetch(`/api/operations/services/${serviceId}`).then((r) => r.json()),
      fetch("/api/admin/category-presets").then((r) => r.json()),
    ])
      .then(([typesJson, svcJson, presetsJson]) => {
        if (svcJson.error) { setFetchError(svcJson.error); return }

        if (Array.isArray(typesJson.types)) setServiceTypes(typesJson.types)
        if (presetsJson.presets) setPresets(presetsJson.presets)

        const svc = svcJson.service
        setServiceType(svc.service_type ?? "")
        setServiceName(svc.name ?? "")
        setDescription(svc.description ?? "")

        // Group stages by category_id, preserving sequence order
        type LoadedStage = {
          id: string
          name: string
          sequence_order: number
          stage_duration_mins: number
          category_id: string | null
          category_name: string | null
          category_role: "detailer" | "installer" | null
          category_color: string | null
        }
        const stageRows: LoadedStage[] = svcJson.stages ?? []

        // Build ordered category sections from the stage data
        const seen = new Map<string, CategorySection>()
        for (const s of stageRows) {
          if (!s.category_id) continue
          if (!seen.has(s.category_id)) {
            seen.set(s.category_id, {
              categoryId:     s.category_id,
              categoryName:   s.category_name ?? s.category_id,
              technicianRole: s.category_role ?? "detailer",
              displayColor:   s.category_color ?? "blue",
              stages:         [],
              dragIndex:      { current: null },
            })
          }
          seen.get(s.category_id)!.stages.push({
            id:                 makeId(),
            dbId:               s.id,
            name:               s.name,
            stage_duration_mins: s.stage_duration_mins ?? 0,
          })
        }
        setSections(Array.from(seen.values()))
      })
      .catch(() => setFetchError("Failed to load service. Please try again."))
      .finally(() => setFetching(false))
  }, [open, serviceId])

  function clearError(key: string) {
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  // ── Section management ──────────────────────────────────────────
  function removeSection(categoryId: string) {
    setSections((prev) => prev.filter((s) => s.categoryId !== categoryId))
  }

  async function handleSelectPreset(preset: PresetItem) {
    try {
      const res  = await fetch("/api/admin/workflow-categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: preset.name, technician_role: preset.technician_role, display_color: preset.display_color }),
      })
      const json = await res.json()
      if (!res.ok) return
      const cat = json.category
      const presetStages = [...(preset.stages ?? [])]
        .sort((a, b) => a.sequence_order - b.sequence_order)
        .map((s) => ({ id: makeId(), name: s.name, stage_duration_mins: s.stage_duration_mins ?? 0 }))
      setSections((prev) => [
        ...prev,
        {
          categoryId:     cat.id,
          categoryName:   cat.name,
          technicianRole: cat.technician_role,
          displayColor:   cat.display_color,
          stages:         presetStages,
          dragIndex:      { current: null },
        },
      ])
      if (errors.sections) clearError("sections")
    } catch {}
  }

  async function handleDeleteType(type: string) {
    setTypeDeleteError(""); setTypeDeleteAffected([]); setTypeDeleteLiveJobs([])
    try {
      const res  = await fetch(`/api/admin/service-types/${encodeURIComponent(type)}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) {
        setTypeDeleteError(json.error ?? "Failed to delete service type.")
        setTypeDeleteAffected(json.affectedServices ?? [])
        setTypeDeleteLiveJobs(json.liveJobs ?? [])
        return
      }
      setServiceTypes((prev) => prev.filter((t) => t !== type))
      if (serviceType === type) setServiceType("")
    } catch {
      setTypeDeleteError("Network error. Please try again.")
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
    clearError(`stage_${stageId}`)
  }

  function updateStageDuration(categoryId: string, stageId: string, mins: number) {
    setSections((prev) =>
      prev.map((sec) =>
        sec.categoryId === categoryId
          ? { ...sec, stages: sec.stages.map((s) => s.id === stageId ? { ...s, stage_duration_mins: mins } : s) }
          : sec
      )
    )
    clearError(`dur_${stageId}`)
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
    if (!serviceType)        e.serviceType = "Service type is required."
    if (!serviceName.trim()) e.serviceName = "Service name is required."
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
    if (Object.keys(errs).length > 0) { setErrors(errs); scrollToTop(); return }
    setSubmitting(true)
    try {
      let seq = 1
      const allStages = sections.flatMap((sec) =>
        sec.stages.map((s) => ({
          dbId:               s.dbId ?? null,
          name:               s.name.trim(),
          category_id:        sec.categoryId,
          sequence_order:     seq++,
          stage_duration_mins: s.stage_duration_mins,
        }))
      )
      const res = await fetch(`/api/operations/services/${serviceId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          serviceName:  serviceName.trim(),
          description:  description.trim(),
          stages:       allStages,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setServerError(json.error ?? "Something went wrong."); scrollToTop(); return }
      onSuccess()
      if (json.warning) {
        setSaveWarning(json.warning)
        setBlockedStageNames(json.blockedStageNames ?? [])
      } else {
        onClose()
      }
    } catch {
      setServerError("Network error. Please try again.")
      scrollToTop()
    } finally {
      setSubmitting(false)
    }
  }

  const usedCategoryNames = new Set(sections.map((s) => s.categoryName.toLowerCase()))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title="Edit Service"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || fetching}>
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </>
      }
    >
        {fetching && <div className="py-16 text-center text-sm text-muted">Loading…</div>}
        {fetchError && !fetching && (
          <p className="py-16 text-center text-sm text-status-delayed">{fetchError}</p>
        )}

        {!fetching && !fetchError && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div ref={topRef} />
            {saveWarning && (
              <div className="bg-status-warning/10 border border-status-warning/30 rounded-sm px-4 py-3 space-y-2">
                <p className="text-sm font-medium text-status-warning">{saveWarning}</p>
                {blockedStageNames.length > 0 && (
                  <ul className="space-y-0.5 pl-3">
                    {blockedStageNames.map((n) => (
                      <li key={n} className="text-xs text-status-warning list-disc">{n}</li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => { setSaveWarning(""); setBlockedStageNames([]); onClose() }}
                  className="text-xs font-medium text-status-warning underline hover:no-underline"
                >
                  Close anyway
                </button>
              </div>
            )}

            {serverError && (
              <div className="bg-status-delayed/10 border border-status-delayed/30 text-status-delayed text-sm rounded-sm px-4 py-3">
                {serverError}
              </div>
            )}

            {/* Service Type */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">
                Service Type <span className="text-status-delayed">*</span>
              </label>
              <ServiceTypeCombobox
                value={serviceType}
                serviceTypes={serviceTypes}
                onChange={(v) => { setServiceType(v); clearError("serviceType") }}
                error={errors.serviceType}
              />
              {typeDeleteError && (
                <div className="mt-1">
                  <p className="text-xs text-status-delayed">{typeDeleteError}</p>
                  {typeDeleteAffected.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5 pl-3">
                      {typeDeleteAffected.map((n) => <li key={n} className="text-xs text-status-delayed list-disc">{n}</li>)}
                    </ul>
                  )}
                  {typeDeleteLiveJobs.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-status-warning mt-1">Active job orders:</p>
                      <ul className="mt-0.5 space-y-0.5 pl-3">
                        {typeDeleteLiveJobs.map((j) => <li key={j} className="text-xs text-status-warning list-disc">{j}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Service Name */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">
                Service Name <span className="text-status-delayed">*</span>
              </label>
              <input
                type="text"
                value={serviceName}
                onChange={(e) => { setServiceName(e.target.value); clearError("serviceName") }}
                placeholder="e.g. Full Detail Package"
                className={`w-full px-3 py-2.5 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                  errors.serviceName ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
              />
              {errors.serviceName && <p className="text-xs text-status-delayed">{errors.serviceName}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Optional — describe what this service includes."
                className="w-full px-3 py-2.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
              />
            </div>

            {/* Estimated Duration — computed from stage durations */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-body">Estimated Duration</label>
              <div className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-sm bg-surface-subtle">
                <Clock className="w-4 h-4 text-muted shrink-0" />
                <span className="text-sm font-medium text-body">
                  {minsToHHMM(totalDurationMins)}
                </span>
                <span className="text-xs text-muted">HH : MM</span>
              </div>
              <p className="text-xs text-muted">
                Auto-calculated from the sum of all stage durations below.
              </p>
            </div>

            {/* Workflow Stages */}
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-heading">Workflow Stages</h3>
                <p className="text-xs text-muted mt-0.5">
                  Add or remove category sections and their stages. Drag to reorder.
                </p>
              </div>

              {errors.sections && <p className="text-xs text-status-delayed">{errors.sections}</p>}
              {sections.length === 0 && !errors.sections && (
                <p className="text-xs text-muted italic">No category sections added yet.</p>
              )}

              {sections.map((sec, secIdx) => {
                const styles = colorStyles(sec.displayColor)
                const dnd    = makeDragHandlers(sec.categoryId, sec.dragIndex)
                return (
                  <div key={sec.categoryId}>
                    {secIdx > 0 && <div className="border-t border-border-subtle mb-5" />}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                          errors[`section_${sec.categoryId}`] ? "text-status-delayed bg-status-delayed/10" : styles.badge
                        }`}>
                          {sec.categoryName}
                          <span className="ml-1 font-normal normal-case opacity-60">({sec.technicianRole}s)</span>
                          <span className="text-status-delayed ml-0.5">*</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeSection(sec.categoryId)}
                          className="p-1 text-muted hover:text-status-delayed transition-colors rounded"
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
                        <p className="text-xs text-muted italic">No stages added yet.</p>
                      )}
                      {errors[`section_${sec.categoryId}`] && (
                        <p className="text-xs text-status-delayed">{errors[`section_${sec.categoryId}`]}</p>
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
                <AddCategoryDropdown
                  presets={presets}
                  usedCategoryNames={usedCategoryNames}
                  onSelectPreset={handleSelectPreset}
                />
              </div>
            </div>

            <p className="text-xs text-muted">
              <span className="text-status-delayed">*</span> Required field
            </p>
          </form>
        )}
    </Drawer>
  )
}
