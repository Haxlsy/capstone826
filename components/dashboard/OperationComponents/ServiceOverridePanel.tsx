"use client"

import { useMemo, useRef, useState } from "react"
import { Layers, RotateCcw, GripVertical, Plus, X } from "lucide-react"

export interface Stage {
  id:             string                         // service_stage.id OR temp client ID when isNew
  name:           string
  category:       "preparation" | "installation"
  sequence_order: number
  isNew?:         boolean                        // true = added for this job only, no service_stage row
}

export interface ServiceInfo {
  id:                      string
  name:                    string
  description:             string | null
  estimated_duration_mins: number
}

interface Props {
  primaryService:     ServiceInfo | null
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
}

const FIELD_CLS =
  "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const LABEL_CLS = "text-xs font-medium text-gray-600"

export default function ServiceOverridePanel({
  primaryService,
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
}: Props) {
  const dragItem     = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

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

  // ── Drag-and-drop (within same category only) ─────────────────────
  function handleDragStart(globalIndex: number) {
    dragItem.current = globalIndex
    setDragging(true)
  }

  function handleDragEnter(globalIndex: number) {
    dragOverItem.current = globalIndex
  }

  function handleDrop(category: "preparation" | "installation") {
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

  function addStage(category: "preparation" | "installation") {
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

  // ── Placeholder ───────────────────────────────────────────────────
  if (!primaryService) {
    return (
      <div className="w-80 shrink-0 bg-white border border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 px-6 py-14 text-center min-h-[260px]">
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <Layers className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500">No service selected</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Pick a service from the form to review and edit its details for this job.
          </p>
        </div>
      </div>
    )
  }

  // ── Stage list ────────────────────────────────────────────────────
  function StageList({
    stages,
    category,
    accentDrag,
    accentFocus,
    accentAdd,
  }: {
    stages:      typeof prepStages
    category:    "preparation" | "installation"
    accentDrag:  string
    accentFocus: string
    accentAdd:   string
  }) {
    return (
      <div
        className="flex flex-col gap-1"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(category)}
      >
        {stages.map((stage, localIdx) => (
          <div
            key={stage.id}
            draggable={!stage.isNew}
            onDragStart={() => !stage.isNew && handleDragStart(stage.globalIndex)}
            onDragEnter={() => handleDragEnter(stage.globalIndex)}
            onDragEnd={() => setDragging(false)}
            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
              dragging && dragItem.current === stage.globalIndex
                ? `${accentDrag} opacity-50`
                : stage.isNew
                  ? "border-dashed border-gray-300 bg-white"
                  : "border-gray-100 bg-gray-50 hover:border-gray-200"
            }`}
          >
            {/* Grip / spacer */}
            {stage.isNew ? (
              <span className="w-3.5 shrink-0" />
            ) : (
              <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 cursor-grab active:cursor-grabbing" />
            )}

            {/* Index */}
            <span className="text-[10px] font-medium text-gray-400 w-4 shrink-0">
              {localIdx + 1}.
            </span>

            {/* Name input */}
            <input
              type="text"
              value={stage.name}
              onChange={(e) => renameStage(stage.id, e.target.value)}
              placeholder={stage.isNew ? "Stage name" : undefined}
              aria-label={`${category === "preparation" ? "Preparation" : "Installation"} stage ${localIdx + 1} name`}
              autoFocus={stage.isNew && stage.name === ""}
              className={`flex-1 min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none border-b border-transparent ${accentFocus} py-0.5 placeholder:text-gray-300`}
            />

            {/* Delete (new stages only) */}
            {stage.isNew && (
              <button
                type="button"
                onClick={() => removeStage(stage.id)}
                aria-label="Remove stage"
                className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Add stage */}
        <button
          type="button"
          onClick={() => addStage(category)}
          className={`flex items-center gap-1 text-xs font-medium mt-1 ${accentAdd} transition-colors w-fit`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Stage
        </button>
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
          <div className="flex flex-col gap-1">
            <label className={LABEL_CLS}>
              Service Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => onNameChange(e.target.value)}
              className={FIELD_CLS}
              placeholder={primaryService.name}
            />
          </div>

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
              <input
                type="number"
                min={1}
                value={
                  Math.round(
                    (customDurationMins ?? primaryService.estimated_duration_mins) / (24 * 60)
                  ) || 1
                }
                onChange={(e) => {
                  const days = parseInt(e.target.value, 10)
                  onDurationChange(isNaN(days) || days <= 0 ? null : days * 24 * 60)
                }}
                aria-label="Estimated duration in days"
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">days</span>
            </div>
            <p className="text-[10px] text-gray-400">
              Used to automatically calculate the job timeline.
            </p>
          </div>
        </div>

        {/* Workflow Stages */}
        <div className="p-4 flex flex-col gap-4">
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
                  accentDrag="border-blue-300 bg-blue-50/50"
                  accentFocus="focus:border-blue-400"
                  accentAdd="text-blue-500 hover:text-blue-700"
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
                  accentDrag="border-purple-300 bg-purple-50/50"
                  accentFocus="focus:border-purple-400"
                  accentAdd="text-purple-500 hover:text-purple-700"
                />
              </div>
            </>
          )}
        </div>
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
