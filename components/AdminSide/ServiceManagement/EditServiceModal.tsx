"use client"

import { useEffect, useRef, useState } from "react"
import { X, GripVertical, Trash2, Plus, Pencil, ChevronDown, Check } from "lucide-react"

const SERVICE_TYPES = [
  "Paint Protection Film",
  "Coating Services",
  "Auto Detailing",
  "Nano Ceramic Tint",
] as const

type ServiceType = typeof SERVICE_TYPES[number]

interface Stage {
  id: string
  name: string
  dbId?: string  // original service_stage.id if it came from the DB
}

interface EditServiceModalProps {
  serviceId: string | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

// ─── Searchable Service Type Combobox ────────────────────────────────────────
function ServiceTypeCombobox({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: ServiceType) => void
  error?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const containerRef      = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  const filtered = SERVICE_TYPES.filter((t) =>
    t.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(type: ServiceType) {
    onChange(type)
    setOpen(false)
    setQuery("")
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!open) setOpen(true)
  }

  function handleToggle() {
    setOpen((v) => !v)
    if (!open) {
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const displayValue = open ? query : value

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center border rounded-lg transition-colors ${
          error
            ? "border-red-400 bg-red-50"
            : open
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-gray-200"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => { setOpen(true); setQuery("") }}
          placeholder="Select service type..."
          className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none"
          readOnly={!open}
        />
        <button
          type="button"
          onClick={handleToggle}
          className="px-3 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-400">No match found.</p>
          ) : (
            filtered.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelect(type)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
              >
                <span className={value === type ? "text-gray-900 font-medium" : "text-gray-700"}>
                  {type}
                </span>
                {value === type && <Check className="w-4 h-4 text-blue-500 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

// ─── Stage List ───────────────────────────────────────────────────────────────
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

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function EditServiceModal({ serviceId, open, onClose, onSuccess }: EditServiceModalProps) {
  const [serviceType,  setServiceType]  = useState<ServiceType | "">("")
  const [serviceName,  setServiceName]  = useState("")
  const [description,  setDescription]  = useState("")
  const [durationHrs,  setDurationHrs]  = useState("0")
  const [durationMins, setDurationMins] = useState("0")

  const [detailerStages,  setDetailerStages]  = useState<Stage[]>([])
  const [installerStages, setInstallerStages] = useState<Stage[]>([])
  const [finisherStages,  setFinisherStages]  = useState<Stage[]>([])

  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [serverError,  setServerError]  = useState("")
  const [fetchError,   setFetchError]   = useState("")
  const [fetching,     setFetching]     = useState(false)
  const [submitting,   setSubmitting]   = useState(false)

  const detailerDragIndex  = useRef<number | null>(null)
  const installerDragIndex = useRef<number | null>(null)
  const finisherDragIndex  = useRef<number | null>(null)

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  useEffect(() => {
    if (!open || !serviceId) return

    setFetching(true)
    setFetchError("")
    setServerError("")
    setErrors({})
    setEditingId(null)

    fetch(`/api/operations/services/${serviceId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setFetchError(json.error); return }

        const svc = json.service
        setServiceType(svc.service_type ?? "")
        setServiceName(svc.name ?? "")
        setDescription(svc.description ?? "")

        const totalMins = svc.estimated_duration_mins ?? 0
        setDurationHrs(String(Math.floor(totalMins / 60)))
        setDurationMins(String(totalMins % 60))

        const stages: Array<{ id: string; name: string; category: string; sequence_order: number }> = json.stages ?? []
        setDetailerStages(
          stages.filter((s) => s.category === "preparation")
            .map((s) => ({ id: makeId(), dbId: s.id, name: s.name }))
        )
        setInstallerStages(
          stages.filter((s) => s.category === "installation")
            .map((s) => ({ id: makeId(), dbId: s.id, name: s.name }))
        )
        setFinisherStages(
          stages.filter((s) => s.category === "finishing")
            .map((s) => ({ id: makeId(), dbId: s.id, name: s.name }))
        )
      })
      .catch(() => setFetchError("Failed to load service. Please try again."))
      .finally(() => setFetching(false))
  }, [open, serviceId])

  function clearError(key: string) {
    if (errors[key]) setErrors((p) => { const n = { ...p }; delete n[key]; return n })
  }

  function addStage(list: "detailer" | "installer" | "finisher") {
    const id = makeId()
    const setter = list === "detailer" ? setDetailerStages : list === "installer" ? setInstallerStages : setFinisherStages
    setter((p) => [...p, { id, name: "" }])
    setEditingId(id)
  }

  function updateStage(list: "detailer" | "installer" | "finisher", id: string, value: string) {
    const setter = list === "detailer" ? setDetailerStages : list === "installer" ? setInstallerStages : setFinisherStages
    setter((p) => p.map((s) => (s.id === id ? { ...s, name: value } : s)))
    clearError(`stage_${id}`)
  }

  function removeStage(list: "detailer" | "installer" | "finisher", id: string) {
    const setter = list === "detailer" ? setDetailerStages : list === "installer" ? setInstallerStages : setFinisherStages
    setter((p) => p.filter((s) => s.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function makeDragHandlers(
    list: "detailer" | "installer" | "finisher",
    dragIndex: React.RefObject<number | null>
  ) {
    const setter = list === "detailer" ? setDetailerStages : list === "installer" ? setInstallerStages : setFinisherStages
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
  const finisherDnd  = makeDragHandlers("finisher", finisherDragIndex)

  function validate() {
    const e: Record<string, string> = {}
    if (!serviceType)          e.serviceType = "Service type is required."
    if (!serviceName.trim())   e.serviceName = "Service name is required."
    const hrs  = Number(durationHrs)
    const mins = Number(durationMins)
    if (isNaN(hrs) || isNaN(mins)) {
      e.duration = "Enter a valid duration."
    } else if (hrs === 0 && mins === 0) {
      e.duration = "Duration must be at least 1 minute."
    } else if (mins < 0 || mins > 59) {
      e.duration = "Minutes must be between 0 and 59."
    }
    if (detailerStages.length === 0)  e.detailerStages  = "At least 1 preparation stage is required."
    if (installerStages.length === 0) e.installerStages = "At least 1 installation stage is required."
    if (finisherStages.length === 0)  e.finisherStages  = "At least 1 finishing stage is required."
    ;[...detailerStages, ...installerStages, ...finisherStages].forEach((s) => {
      if (!s.name.trim()) e[`stage_${s.id}`] = "Stage name cannot be empty."
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
      const totalMins = Number(durationHrs) * 60 + Number(durationMins)
      let seq = 1
      const allStages = [
        ...detailerStages.map((s)  => ({ dbId: s.dbId ?? null, name: s.name.trim(), category: "preparation",  sequence_order: seq++ })),
        ...installerStages.map((s) => ({ dbId: s.dbId ?? null, name: s.name.trim(), category: "installation", sequence_order: seq++ })),
        ...finisherStages.map((s)  => ({ dbId: s.dbId ?? null, name: s.name.trim(), category: "finishing",     sequence_order: seq++ })),
      ]
      const res = await fetch(`/api/operations/services/${serviceId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          serviceName:           serviceName.trim(),
          description:           description.trim(),
          estimatedDurationMins: totalMins,
          stages:                allStages,
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
          <h2 className="text-lg font-semibold text-gray-800">Edit Service</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {fetching ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Loading service…
          </div>
        ) : fetchError ? (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-red-500 text-center">{fetchError}</p>
          </div>
        ) : (
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
                value={serviceType}
                onChange={(v) => { setServiceType(v); clearError("serviceType") }}
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
                value={serviceName}
                onChange={(e) => { setServiceName(e.target.value); clearError("serviceName") }}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Optional — describe what this service includes."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors resize-none"
              />
            </div>

            {/* Estimated Duration — HH:MM */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Estimated Duration <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className={`flex items-center border rounded-lg overflow-hidden transition-colors ${
                  errors.duration ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}>
                  <input
                    type="number"
                    min="0"
                    value={durationHrs}
                    onChange={(e) => { setDurationHrs(e.target.value); clearError("duration") }}
                    className="w-16 px-3 py-2.5 text-sm text-center bg-transparent focus:outline-none"
                    placeholder="00"
                  />
                  <span className="text-gray-400 text-sm font-medium px-0.5">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={durationMins}
                    onChange={(e) => { setDurationMins(e.target.value); clearError("duration") }}
                    className="w-16 px-3 py-2.5 text-sm text-center bg-transparent focus:outline-none"
                    placeholder="00"
                  />
                </div>
                <span className="text-sm text-gray-500">HH : MM</span>
              </div>
              {errors.duration && <p className="text-xs text-red-500">{errors.duration}</p>}
              <p className="text-xs text-gray-400">
                Used to automatically calculate the job timeline when a job order is created.
              </p>
            </div>

            {/* Workflow Stages */}
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Workflow Stages</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Drag to reorder within each section. Removing a stage here will remove it from the service.
                </p>
              </div>

              {/* Preparation Team (Detailers) */}
              <div className="space-y-2.5">
                <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${errors.detailerStages ? "text-red-700 bg-red-50" : "text-blue-700 bg-blue-50"}`}>
                  Preparation Team (Detailers) <span className="text-red-500">*</span>
                </span>
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
                {detailerStages.length === 0 && !errors.detailerStages && (
                  <p className="text-xs text-gray-400 italic">No stages added yet.</p>
                )}
                {errors.detailerStages && (
                  <p className="text-xs text-red-500">{errors.detailerStages}</p>
                )}
                <button
                  type="button"
                  onClick={() => addStage("detailer")}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Stage
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Installation Team (Installers) */}
              <div className="space-y-2.5">
                <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${errors.installerStages ? "text-red-700 bg-red-50" : "text-purple-700 bg-purple-50"}`}>
                  Installation Team (Installers) <span className="text-red-500">*</span>
                </span>
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
                {installerStages.length === 0 && !errors.installerStages && (
                  <p className="text-xs text-gray-400 italic">No stages added yet.</p>
                )}
                {errors.installerStages && (
                  <p className="text-xs text-red-500">{errors.installerStages}</p>
                )}
                <button
                  type="button"
                  onClick={() => addStage("installer")}
                  className="flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Stage
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Finishing Stage (Detailers) */}
              <div className="space-y-2.5">
                <span className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full ${errors.finisherStages ? "text-red-700 bg-red-50" : "text-emerald-700 bg-emerald-50"}`}>
                  Finishing Stage (Detailers) <span className="text-red-500">*</span>
                </span>
                <StageList
                  stages={finisherStages}
                  errors={errors}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  onUpdate={(id, val) => updateStage("finisher", id, val)}
                  onRemove={(id) => removeStage("finisher", id)}
                  onDragStart={finisherDnd.onDragStart}
                  onDragOver={finisherDnd.onDragOver}
                  onDragEnd={finisherDnd.onDragEnd}
                  placeholder="Stage name (e.g. Final Inspection)"
                />
                {finisherStages.length === 0 && !errors.finisherStages && (
                  <p className="text-xs text-gray-400 italic">No stages added yet.</p>
                )}
                {errors.finisherStages && (
                  <p className="text-xs text-red-500">{errors.finisherStages}</p>
                )}
                <button
                  type="button"
                  onClick={() => addStage("finisher")}
                  className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
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
        )}

        {/* Footer */}
        {!fetching && !fetchError && (
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
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
