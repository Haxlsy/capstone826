"use client"

import { useMemo, useRef, useState } from "react"
import { Layers, RotateCcw, GripVertical, Plus, X, ChevronDown } from "lucide-react"

export interface Stage {
  id:                  string
  name:                string
  category_id:         string | null
  category_name:       string | null
  category_color:      string | null
  sequence_order:      number
  stage_duration_mins: number
  isNew?:              boolean
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
  /** True when stages couldn't be loaded (offline + not in the bulk snapshot)
   *  — distinct from a service that genuinely has zero stages defined. */
  stagesUnavailable?: boolean
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
  "w-full border border-border rounded-sm px-3 py-1.5 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
const LABEL_CLS = "text-xs font-medium text-body"

// Declared at module scope so React never sees it as a new component type on re-renders.
// Defining it inside the parent body caused unmount/remount on every keystroke (focus loss).
type StageWithIndex = Stage & { globalIndex: number }

function StageList({
  stages,
  categoryId,
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
  onUpdateDuration,
  onRemove,
  onAdd,
}: {
  stages:           StageWithIndex[]
  categoryId:       string | null
  dragging:         boolean
  dragItemRef:      React.MutableRefObject<number | null>
  accentDrag:       string
  accentFocus:      string
  accentAdd:        string
  onDragStart:      (globalIndex: number) => void
  onDragEnter:      (globalIndex: number) => void
  onDragEnd:        () => void
  onDrop:           (categoryId: string | null) => void
  onRename:         (id: string, name: string) => void
  onUpdateDuration: (id: string, mins: number) => void
  onRemove:         (id: string) => void
  onAdd:            (categoryId: string | null) => void
}) {
  return (
    <div
      className="flex flex-col gap-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(categoryId)}
    >
      {stages.map((stage, localIdx) => {
        const durMins = stage.stage_duration_mins ?? 0
        const durHH   = Math.floor(durMins / 60)
        const durMM   = durMins % 60
        return (
          <div
            key={stage.id}
            draggable={!stage.isNew}
            onDragStart={() => !stage.isNew && onDragStart(stage.globalIndex)}
            onDragEnter={() => onDragEnter(stage.globalIndex)}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 transition-colors ${
              dragging && dragItemRef.current === stage.globalIndex
                ? `${accentDrag} opacity-50`
                : stage.isNew
                  ? "border-dashed border-border bg-surface"
                  : "border-border-subtle bg-surface-subtle hover:border-border"
            }`}
          >
            {stage.isNew ? (
              <span className="w-3.5 shrink-0" />
            ) : (
              <GripVertical className="w-3.5 h-3.5 text-muted shrink-0 cursor-grab active:cursor-grabbing" />
            )}

            <span className="text-[10px] font-medium text-muted w-4 shrink-0">
              {localIdx + 1}.
            </span>

            <input
              type="text"
              value={stage.name}
              onChange={(e) => onRename(stage.id, e.target.value)}
              placeholder={stage.isNew ? "Stage name" : undefined}
              aria-label={`${categoryId ?? "unknown"} stage ${localIdx + 1} name`}
              autoFocus={stage.isNew && stage.name === ""}
              className={`flex-1 min-w-0 bg-transparent text-xs text-body focus:outline-none border-b border-transparent ${accentFocus} py-0.5 placeholder:text-muted`}
            />

            {/* Per-stage HH:MM duration */}
            <div className="flex items-center border border-border rounded overflow-hidden shrink-0">
              <input
                type="number"
                min={0}
                value={durHH}
                onChange={(e) => {
                  const hh = Math.max(0, parseInt(e.target.value, 10) || 0)
                  onUpdateDuration(stage.id, hh * 60 + durMM)
                }}
                aria-label={`Stage ${localIdx + 1} hours`}
                className="w-11 px-1 py-0.5 text-[10px] text-center bg-surface focus:outline-none text-body"
              />
              <span className="text-[10px] text-muted">:</span>
              <input
                type="number"
                min={0}
                max={59}
                value={durMM}
                onChange={(e) => {
                  const mm = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0))
                  onUpdateDuration(stage.id, durHH * 60 + mm)
                }}
                aria-label={`Stage ${localIdx + 1} minutes`}
                className="w-11 px-1 py-0.5 text-[10px] text-center bg-surface focus:outline-none text-body"
              />
            </div>

            {stage.isNew && (
              <button
                type="button"
                onClick={() => onRemove(stage.id)}
                aria-label="Remove stage"
                className="shrink-0 text-muted hover:text-status-delayed transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onAdd(categoryId)}
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
  stagesUnavailable = false,
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

  // ── Total duration derived from stage durations ────────────────────
  const totalDurationMins = useMemo(
    () => customStages.reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0),
    [customStages]
  )
  const displayHrs = Math.floor(totalDurationMins / 60)
  const displayMins = totalDurationMins % 60

  // ── Drag-and-drop (within same category only) ─────────────────────
  function handleDragStart(globalIndex: number) {
    dragItem.current = globalIndex
    setDragging(true)
  }

  function handleDragEnter(globalIndex: number) {
    dragOverItem.current = globalIndex
  }

  function handleDrop(categoryId: string | null) {
    setDragging(false)
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    const fromStage = customStages[dragItem.current]
    const toStage   = customStages[dragOverItem.current]
    if (!fromStage || !toStage) return
    if (fromStage.category_id !== categoryId || toStage.category_id !== categoryId) return

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

  function addStage(categoryId: string | null) {
    const template = customStages.find((s) => s.category_id === categoryId)
    const newStage: Stage = {
      id:                  `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name:                "",
      category_id:         categoryId,
      category_name:       template?.category_name ?? null,
      category_color:      template?.category_color ?? null,
      sequence_order:      customStages.length + 1,
      stage_duration_mins: 0,
      isNew:               true,
    }
    onStagesChange([...customStages, newStage])
  }

  function updateStageDuration(id: string, mins: number) {
    const next = customStages.map((s) => s.id === id ? { ...s, stage_duration_mins: mins } : s)
    onStagesChange(next)
    const total = next.reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0)
    onDurationChange(total === 0 ? null : total)
  }

  // Derive unique category sections in the order they first appear
  const stageSections = useMemo(() => {
    const seen = new Map<string | null, {
      categoryId:    string | null
      categoryName:  string | null
      categoryColor: string | null
      stages:        (Stage & { globalIndex: number })[]
    }>()
    customStages.forEach((s, i) => {
      const key = s.category_id ?? `_${s.category_name}`
      if (!seen.has(key)) {
        seen.set(key, {
          categoryId:    s.category_id,
          categoryName:  s.category_name,
          categoryColor: s.category_color,
          stages:        [],
        })
      }
      seen.get(key)!.stages.push({ ...s, globalIndex: i })
    })
    return Array.from(seen.values())
  }, [customStages])

  // ── Placeholder (no service type selected yet) ────────────────────
  if (!primaryService && availableServices.length === 0) {
    return (
      <div className="w-80 shrink-0 bg-surface border border-border rounded-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center min-h-[260px]">
        <div className="w-10 h-10 rounded-full bg-surface-muted flex items-center justify-center">
          <Layers className="w-5 h-5 text-muted" />
        </div>
        <div>
          <p className="text-sm font-medium text-body">No service selected</p>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            Select a service type from the form to get started.
          </p>
        </div>
      </div>
    )
  }

  // ── Panel ─────────────────────────────────────────────────────────
  return (
    <div className="w-80 shrink-0 bg-surface border border-border rounded-card flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-body">Service Override</p>
          {isModified && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
              modified
            </span>
          )}
        </div>
        {isModified && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[10px] font-medium text-muted hover:text-body transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Service fields */}
        <div className="p-4 flex flex-col gap-3 border-b border-border-subtle">
          {/* Service Type badge */}
          {(primaryService?.service_type ?? availableServices[0]?.service_type) && (
            <div className="flex flex-col gap-1">
              <p className={LABEL_CLS}>Service Type</p>
              <span className="inline-flex w-fit items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {primaryService?.service_type ?? availableServices[0]?.service_type}
              </span>
            </div>
          )}

          {/* Service Name — searchable combobox */}
          <div className="flex flex-col gap-1 relative">
            <label className={LABEL_CLS}>
              Service Name <span className="text-status-delayed">*</span>
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
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            </div>
            {nameDropdownOpen && filteredNameServices.length > 0 && (
              <div className="absolute z-50 w-full top-full mt-1 bg-surface border border-border rounded-sm shadow-pop overflow-hidden">
                <div className="max-h-48 overflow-y-auto">
                  {filteredNameServices.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { onServiceSelect(s); setNameDropdownOpen(false) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors border-b last:border-none border-border-subtle"
                    >
                      <span className="font-medium text-heading">{s.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!primaryService && (
            <p className="text-xs text-muted text-center py-4">
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
            <p className={LABEL_CLS}>Estimated Duration</p>
            <div className="flex items-center gap-2 px-2.5 py-1.5 border border-border rounded-sm bg-surface-subtle">
              <span className="text-sm font-medium text-body tabular-nums">
                {String(displayHrs).padStart(2, "0")}:{String(displayMins).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-muted">HH : MM</span>
            </div>
            <p className="text-[10px] text-muted">
              Sum of all stage durations. Set per stage below.
            </p>
          </div>
            </>
          )}
        </div>

        {/* Workflow Stages */}
        {primaryService && <div className="p-4 flex flex-col gap-4">
          <p className="text-xs font-semibold text-body">Workflow Stages</p>

          {stagesLoading ? (
            <p className="text-xs text-muted">Loading stages…</p>
          ) : stageSections.length === 0 && stagesUnavailable ? (
            <p className="text-xs text-status-delayed italic">
              Stages unavailable offline for this service — reconnect to load them.
            </p>
          ) : stageSections.length === 0 ? (
            <p className="text-xs text-muted italic">No stages defined for this service.</p>
          ) : (
            stageSections.map((sec) => {
              const color = sec.categoryColor ?? "blue"
              const accentMap: Record<string, { drag: string; focus: string; add: string }> = {
                blue:    { drag: "border-primary/40 bg-primary",     focus: "focus:border-primary",     add: "text-primary hover:text-primary" },
                purple:  { drag: "border-purple-300 bg-purple-50/50", focus: "focus:border-purple-400",   add: "text-purple-500 hover:text-purple-700" },
                emerald: { drag: "border-status-inspection/40 bg-status-inspection", focus: "focus:border-status-inspection", add: "text-status-inspection hover:text-status-inspection" },
                orange:  { drag: "border-status-rework/40 bg-status-rework/5", focus: "focus:border-orange-400",   add: "text-status-rework hover:text-status-rework" },
                rose:    { drag: "border-rose-300 bg-rose-50/50",     focus: "focus:border-rose-400",     add: "text-rose-500 hover:text-rose-700" },
                teal:    { drag: "border-teal-300 bg-teal-50/50",     focus: "focus:border-teal-400",     add: "text-teal-500 hover:text-teal-700" },
                yellow:  { drag: "border-yellow-300 bg-yellow-50/50", focus: "focus:border-yellow-400",   add: "text-yellow-500 hover:text-yellow-700" },
              }
              const accent = accentMap[color] ?? accentMap.blue
              const textColor: Record<string, string> = {
                blue: "text-primary", purple: "text-purple-600", emerald: "text-emerald-600",
                orange: "text-status-rework", rose: "text-rose-600", teal: "text-teal-600", yellow: "text-yellow-600",
              }
              return (
                <div key={sec.categoryId ?? sec.categoryName} className="flex flex-col gap-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${textColor[color] ?? "text-primary"}`}>
                    {sec.categoryName ?? "Unknown"}
                  </p>
                  <StageList
                    stages={sec.stages}
                    categoryId={sec.categoryId}
                    dragging={dragging}
                    dragItemRef={dragItem}
                    accentDrag={accent.drag}
                    accentFocus={accent.focus}
                    accentAdd={accent.add}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDragEnd={() => setDragging(false)}
                    onDrop={handleDrop}
                    onRename={renameStage}
                    onUpdateDuration={updateStageDuration}
                    onRemove={removeStage}
                    onAdd={addStage}
                  />
                </div>
              )
            })
          )}
        </div>}
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-border-subtle">
        <p className="text-[10px] text-muted leading-relaxed">
          Changes apply to this job only and will not affect the original service.
        </p>
      </div>
    </div>
  )
}
