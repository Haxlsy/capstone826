"use client"

import { useMemo, useRef, useState } from "react"
import { Layers, RotateCcw, GripVertical, Plus, X, ChevronDown } from "lucide-react"

export interface Stage {
  id:             string
  name:           string
  category:       "preparation" | "installation" | "finishing"
  sequence_order: number
  isNew?:         boolean
}

export interface ServiceInfo {
  id:                      string
  name:                    string
  service_type:            string | null
  description:             string | null
  estimated_duration_mins: number
}

interface Props {
  primaryService:     ServiceInfo | null
  availableServices:  ServiceInfo[]
  originalStages:     Stage[]
  stagesLoading:      boolean
  customName:         string
  customDescription:  string
  customDurationMins: number | null
  customStages:       Stage[]
  onNameChange:        (v: string) => void
  onDescriptionChange: (v: string) => void
  onDurationChange:    (v: number | null) => void
  onStagesChange:      (stages: Stage[]) => void
  onReset:             () => void
  onServiceSelect:     (service: ServiceInfo) => void
  onServiceClear:      () => void
}

const FIELD_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const LABEL_CLS = "text-xs font-medium text-gray-600"

// Declared at module scope so React never sees it as a new component type on re-renders.
// Defining it inside the parent body caused unmount/remount on every keystroke (focus loss).
type StageWithIndex = Stage & { globalIndex: number }

function StageList({
  stages,
  category,
  dragging,
  dragItemRef,
  accentDrag,
  accentFocus,
  accentAdd,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onRename,
  onRemove,
  onAdd,
}: {
  stages:       StageWithIndex[]
  category:     "preparation" | "installation" | "finishing"
  dragging:     boolean
  dragItemRef:  React.MutableRefObject<number | null>
  accentDrag:   string
  accentFocus:  string
  accentAdd:    string
  onDragStart:  (globalIndex: number) => void
  onDragEnter:  (globalIndex: number) => void
  onDragEnd:    () => void
  onDrop:       (category: "preparation" | "installation" | "finishing") => void
  onRename:     (id: string, name: string) => void
  onRemove:     (id: string) => void
  onAdd:        (category: "preparation" | "installation" | "finishing") => void
}) {
  return (
    <div
      className="flex flex-col gap-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(category)}
    >
      {stages.map((stage, localIdx) => (
        <div
          key={stage.id}
          draggable={!stage.isNew}
          onDragStart={() => !stage.isNew && onDragStart(stage.globalIndex)}
          onDragEnter={() => onDragEnter(stage.globalIndex)}
          onDragEnd={onDragEnd}
          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
            dragging && dragItemRef.current === stage.globalIndex
              ? `${accentDrag} opacity-50`
              : stage.isNew
                ? "border-dashed border-gray-300 bg-white"
                : "border-gray-100 bg-gray-50 hover:border-gray-200"
          }`}
        >
          {stage.isNew ? (
            <span className="w-3.5 shrink-0" />
          ) : (
            <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 cursor-grab active:cursor-grabbing" />
          )}

          <span className="text-[10px] font-medium text-gray-400 w-4 shrink-0">
            {localIdx + 1}.
          </span>

          <input
            type="text"
            value={stage.name}
            onChange={(e) => onRename(stage.id, e.target.value)}
            placeholder={stage.isNew ? "Stage name" : undefined}
            aria-label={`${category} stage ${localIdx + 1} name`}
            autoFocus={stage.isNew && stage.name === ""}
            className={`flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none border-b border-transparent ${accentFocus} py-0.5 placeholder:text-gray-300`}
          />

          {stage.isNew && (
            <button
              type="button"
              onClick={() => onRemove(stage.id)}
              aria-label="Remove stage"
              className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onAdd(category)}
        className={`flex items-center gap-1 text-xs font-medium mt-1 ${accentAdd} transition-colors w-fit`}
      >
        <Plus className="w-3.5 h-3.5" />
        Add Stage
      </button>
    </div>
  )
}

export default function ServiceOverridePanel({
  primaryService,
  availableServices,
  originalStages,
  stagesLoading,
  customName,
  customDescription,
  customDurationMins,
  customStages,
  onNameChange,
  onDescriptionChange,
  onDurationChange,
  onStagesChange,
  onReset,
  onServiceSelect,
  onServiceClear,
}: Props) {
  const dragItem     = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragging,         setDragging]         = useState(false)
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false)

  const filteredNameServices = useMemo(() =>
    customName.trim()
      ? availableServices.filter((s) => s.name.toLowerCase().includes(customName.toLowerCase()))
      : availableServices,
    [availableServices, customName]
  )

  const isModified = useMemo(() => {
    if (!primaryService) return false
    if (customName !== primaryService.name) return true
    if (customDescription !== (primaryService.description ?? "")) return true
    if (customDurationMins !== null) return true
    if (customStages.some((s) => s.isNew)) return true
    if (customStages.length !== originalStages.length) return true
    return customStages.some((s, i) => {
      const orig = originalStages[i]
      return !orig || s.id !== orig.id || s.name !== orig.name
    })
  }, [primaryService, customName, customDescription, customDurationMins, customStages, originalStages])

  // ── Derived HH:MM from current duration ────────────────────────────
  const effectiveMins = customDurationMins ?? (primaryService?.estimated_duration_mins ?? 0)
  const displayHrs    = Math.floor(effectiveMins / 60)
  const displayMins   = effectiveMins % 60

  function handleHrsChange(raw: string) {
    const hrs = parseInt(raw, 10)
    if (isNaN(hrs) || hrs < 0) return
    const total = hrs * 60 + displayMins
    onDurationChange(total === 0 ? null : total)
  }

  function handleMinsChange(raw: string) {
    const mins = parseInt(raw, 10)
    if (isNaN(mins) || mins < 0 || mins > 59) return
    const total = displayHrs * 60 + mins
    onDurationChange(total === 0 ? null : total)
  }

  // ── Drag-and-drop (within same category only) ─────────────────────
  function handleDragStart(globalIndex: number) {
    dragItem.current = globalIndex
    setDragging(true)
  }

  function handleDragEnter(globalIndex: number) {
    dragOverItem.current = globalIndex
  }

  function handleDrop(category: "preparation" | "installation" | "finishing") {
    setDragging(false)
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const fromStage = customStages[dragItem.current]
    const toStage   = customStages[dragOverItem.current]
    if (!fromStage || !toStage) return
    if (fromStage.category !== category || toStage.category !== category) return

    const next = [...customStages]
    next.splice(dragItem.current, 1)
    const newTo = next.indexOf(toStage)
    next.splice(newTo < 0 ? dragOverItem.current : newTo, 0, fromStage)
    onStagesChange(next.map((s, i) => ({ ...s, sequence_order: i + 1 })))

    dragItem.current     = null
    dragOverItem.current = null
  }

  function renameStage(id: string, name: string) {
    onStagesChange(customStages.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  function removeStage(id: string) {
    const next = customStages.filter((s) => s.id !== id)
    onStagesChange(next.map((s, i) => ({ ...s, sequence_order: i + 1 })))
  }

  function addStage(category: "preparation" | "installation" | "finishing") {
    const newStage: Stage = {
      id:             `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name:           "",
      category,
      sequence_order: customStages.length + 1,
      isNew:          true,
    }
    onStagesChange([...customStages, newStage])
  }

  const prepStages    = customStages.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => s.category === "preparation")
  const installStages = customStages.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => s.category === "installation")
  const finishStages  = customStages.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => s.category === "finishing")

  // ── Placeholder (no service type selected yet) ────────────────────
  if (!primaryService && availableServices.length === 0) {
    return (
      <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 px-6 py-14 text-center min-h-[260px]">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Layers className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">No service selected</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Select a service type from the form to get started.
          </p>
        </div>
      </div>
    )
  }

  // ── Panel ─────────────────────────────────────────────────────────
  return (
    <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-700">Service Override</p>
          {isModified && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
              modified
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Service fields */}
        <div className="p-4 flex flex-col gap-3 border-b border-gray-100">
          {/* Service Type badge */}
          {(primaryService?.service_type ?? availableServices[0]?.service_type) && (
            <div className="flex flex-col gap-1">
              <p className={LABEL_CLS}>Service Type</p>
              <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {primaryService?.service_type ?? availableServices[0]?.service_type}
              </span>
            </div>
          )}

          {/* Service Name — searchable combobox */}
          <div className="flex flex-col gap-1 relative">
            <label className={LABEL_CLS}>
              Service Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={customName}
                onChange={(e) => {
                  onNameChange(e.target.value)
                  if (e.target.value === "") onServiceClear()
                  else setNameDropdownOpen(true)
                }}
                onFocus={() => setNameDropdownOpen(true)}
                onBlur={() => setTimeout(() => setNameDropdownOpen(false), 200)}
                className={`${FIELD_CLS} pr-7`}
                placeholder="Search or select a service name…"
              />
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            </div>
            {nameDropdownOpen && filteredNameServices.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {filteredNameServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { onServiceSelect(s); setNameDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors border-b last:border-none border-gray-50"
                    >
                      <span className="font-medium text-gray-800">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!primaryService && (
            <p className="text-xs text-gray-400 text-center py-4">
              Select a service name above to see its details and workflow stages.
            </p>
          )}

          {primaryService && (
            <>
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLS}>Description</label>
            <textarea
              value={customDescription}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={3}
              aria-label="Service description"
              className={`${FIELD_CLS} resize-none`}
              placeholder={primaryService.description ?? "Optional description"}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={LABEL_CLS}>
              Estimated Duration <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <input
                  type="number"
                  min={0}
                  value={displayHrs}
                  onChange={(e) => handleHrsChange(e.target.value)}
                  aria-label="Estimated duration hours"
                  className="w-14 px-2 py-1.5 text-sm text-center text-gray-700 bg-white focus:outline-none"
                />
                <span className="text-gray-400 text-sm font-medium px-0.5">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={displayMins}
                  onChange={(e) => handleMinsChange(e.target.value)}
                  aria-label="Estimated duration minutes"
                  className="w-14 px-2 py-1.5 text-sm text-center text-gray-700 bg-white focus:outline-none"
                />
              </div>
              <span className="text-xs text-gray-400">HH : MM</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Used to automatically calculate the job timeline.
            </p>
          </div>
            </>
          )}
        </div>

        {/* Workflow Stages */}
        {primaryService && <div className="p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold text-gray-700">Workflow Stages</p>

          {stagesLoading ? (
            <p className="text-xs text-gray-400">Loading stages…</p>
          ) : (
            <>
              {/* Preparation Team */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                  Preparation Team (Detailers)
                </p>
                <StageList
                  stages={prepStages}
                  category="preparation"
                  dragging={dragging}
                  dragItemRef={dragItem}
                  accentDrag="border-blue-300 bg-blue-50/50"
                  accentFocus="focus:border-blue-400"
                  accentAdd="text-blue-500 hover:text-blue-700"
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={() => setDragging(false)}
                  onDrop={handleDrop}
                  onRename={renameStage}
                  onRemove={removeStage}
                  onAdd={addStage}
                />
              </div>

              {/* Installation Team */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                  Installation Team (Installers)
                </p>
                <StageList
                  stages={installStages}
                  category="installation"
                  dragging={dragging}
                  dragItemRef={dragItem}
                  accentDrag="border-purple-300 bg-purple-50/50"
                  accentFocus="focus:border-purple-400"
                  accentAdd="text-purple-500 hover:text-purple-700"
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={() => setDragging(false)}
                  onDrop={handleDrop}
                  onRename={renameStage}
                  onRemove={removeStage}
                  onAdd={addStage}
                />
              </div>

              {/* Finishing Stage */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                  Finishing Stage (Detailers)
                </p>
                <StageList
                  stages={finishStages}
                  category="finishing"
                  dragging={dragging}
                  dragItemRef={dragItem}
                  accentDrag="border-emerald-300 bg-emerald-50/50"
                  accentFocus="focus:border-emerald-400"
                  accentAdd="text-emerald-500 hover:text-emerald-700"
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={() => setDragging(false)}
                  onDrop={handleDrop}
                  onRename={renameStage}
                  onRemove={removeStage}
                  onAdd={addStage}
                />
              </div>
            </>
          )}
        </div>}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Changes apply to this job only and will not affect the original service.
        </p>
      </div>
    </div>
  )
}
