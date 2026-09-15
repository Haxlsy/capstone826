"use client"

import { useEffect, useRef, useState } from "react"
import { GripVertical, Trash2, Pencil, Plus, ChevronDown, ChevronUp, Check, X } from "lucide-react"
import { HourMinuteInput } from "@/components/ui/Field"

export type ServiceType = string

export interface Stage {
  id:                 string
  name:               string
  dbId?:              string
  stage_duration_mins: number
}

// ─── Duration helpers ─────────────────────────────────────────────────────────
export function sumStageDurations(stages: Stage[]): number {
  return stages.reduce((acc, s) => acc + (s.stage_duration_mins ?? 0), 0)
}

export function minsToHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function hhmmToMins(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

export interface WorkflowCategory {
  id: string
  name: string
  technician_role: "detailer" | "installer"
  display_color: string
}

export interface PresetItem {
  id:              string
  name:            string
  technician_role: "detailer" | "installer"
  display_color:   string
  stages:          Array<{ id: string; name: string; sequence_order: number; stage_duration_mins: number }>
}

export interface CategorySection {
  categoryId: string
  categoryName: string
  technicianRole: "detailer" | "installer"
  displayColor: string
  stages: Stage[]
  dragIndex: React.RefObject<number | null>
}

export const COLOR_STYLES: Record<string, { badge: string; button: string }> = {
  blue:    { badge: "text-primary bg-primary/10",       button: "text-primary hover:text-primary" },
  purple:  { badge: "text-status-concern bg-status-concern/10",   button: "text-status-concern hover:text-status-concern" },
  emerald: { badge: "text-status-inspection bg-status-inspection/10", button: "text-status-inspection hover:text-status-inspection" },
  orange:  { badge: "text-status-rework bg-status-rework/10",   button: "text-status-rework hover:text-status-rework" },
  rose:    { badge: "text-status-delayed bg-status-delayed/10",       button: "text-status-delayed hover:text-status-delayed" },
  teal:    { badge: "text-status-release bg-status-release/10",       button: "text-status-release hover:text-status-release" },
  yellow:  { badge: "text-status-warning bg-status-warning/10",   button: "text-status-warning hover:text-status-warning" },
}

export const COLOR_OPTIONS = Object.keys(COLOR_STYLES)

export function colorStyles(color: string) {
  return COLOR_STYLES[color] ?? COLOR_STYLES.blue
}

export function makeId() {
  return Math.random().toString(36).slice(2)
}

// ─── Searchable Service Type Combobox ────────────────────────────────────────
export function ServiceTypeCombobox({
  value,
  serviceTypes,
  onChange,
  error,
}: {
  value: string
  serviceTypes: string[]
  onChange: (v: string) => void
  error?: string
}) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState("")
  const containerRef      = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  const filtered = serviceTypes.filter((t) =>
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

  const displayValue = open ? query : value

  function selectType(type: string) {
    onChange(type)
    setOpen(false)
    setQuery("")
  }

  return (
    <>
      <div ref={containerRef} className="relative">
        <div
          className={`flex items-center border rounded-sm transition-colors ${
            error ? "border-status-delayed bg-status-delayed/10" : open ? "border-primary ring-2 ring-primary/20" : "border-border"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
            onFocus={() => { setOpen(true); setQuery("") }}
            placeholder="Select a service type..."
            className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v)
              if (!open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0) }
            }}
            className="px-3 text-muted hover:text-body transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border-subtle rounded-card shadow-pop z-20 overflow-hidden">
            {filtered.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-surface-muted transition-colors"
              >
                <span className={value === type ? "text-heading font-medium" : "text-body"}>{type}</span>
                {value === type && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2.5 text-sm text-muted">No service types yet.</p>
            )}
          </div>
        )}

        {error && <p className="text-xs text-status-delayed mt-0.5">{error}</p>}
      </div>
    </>
  )
}

// ─── Stage List ───────────────────────────────────────────────────────────────
export function StageList({
  stages,
  errors,
  editingId,
  setEditingId,
  onUpdate,
  onUpdateDuration,
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
  onUpdateDuration: (id: string, mins: number) => void
  onRemove: (id: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      {stages.map((stage, index) => {
        const isEditing  = editingId === stage.id
        const durMins    = stage.stage_duration_mins ?? 0
        const durHH      = Math.floor(durMins / 60)
        const durMM      = durMins % 60
        const durError   = errors[`dur_${stage.id}`]

        function commitDuration(hh: number, mm: number) {
          const total = Math.max(0, hh) * 60 + Math.min(59, Math.max(0, mm))
          onUpdateDuration(stage.id, total)
        }

        return (
          <div
            key={stage.id}
            draggable
            onDragStart={() => onDragStart(index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDragEnd={onDragEnd}
            className="flex flex-col gap-1 group pb-3"
          >
            <div className="flex items-center gap-2">
              <div className="cursor-grab active:cursor-grabbing text-muted hover:text-muted shrink-0">
                <GripVertical className="w-4 h-4" />
              </div>
              <span className="text-sm text-muted w-5 shrink-0 text-right">{index + 1}.</span>

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={stage.name}
                    onChange={(e) => onUpdate(stage.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingId(null) }}
                    placeholder={placeholder}
                    className={`w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                      errors[`stage_${stage.id}`] ? "border-status-delayed bg-status-delayed/10" : "border-border"
                    }`}
                  />
                ) : (
                  <div
                    className={`flex items-center justify-between px-3 py-2 text-sm border rounded-sm bg-surface-subtle cursor-text ${
                      errors[`stage_${stage.id}`] ? "border-status-delayed" : "border-border"
                    }`}
                    onClick={() => setEditingId(stage.id)}
                  >
                    <span className={stage.name ? "text-body" : "text-muted"}>
                      {stage.name || placeholder}
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-muted shrink-0 ml-2" />
                  </div>
                )}
                {errors[`stage_${stage.id}`] && (
                  <p className="text-xs text-status-delayed mt-0.5">{errors[`stage_${stage.id}`]}</p>
                )}
              </div>

              <HourMinuteInput
                hours={durHH}
                minutes={durMM}
                onChange={commitDuration}
                ariaLabelPrefix={`Stage ${index + 1}`}
                invalid={!!durError}
                size="md"
              />

              <button
                type="button"
                onClick={() => onRemove(stage.id)}
                className="shrink-0 p-1 text-muted hover:text-status-delayed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {durError && (
              <p className="text-xs text-status-delayed pl-11">{durError}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Add Category Dropdown ────────────────────────────────────────────────────
export function AddCategoryDropdown({
  presets,
  usedCategoryNames,
  onSelectPreset,
}: {
  presets:           PresetItem[]
  usedCategoryNames: Set<string>
  onSelectPreset:    (preset: PresetItem) => void
}) {
  const [open, setOpen] = useState(false)
  const ref        = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        dropdownRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      }, 50)
    }
  }, [open])

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-body border border-dashed border-border rounded-sm px-3 py-2 hover:border-primary/40 hover:bg-surface-muted transition-colors"
      >
        <Plus className="w-4 h-4" />
        Select Category Section
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {open && (
        <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border-subtle rounded-card shadow-pop z-20 overflow-hidden">
          {presets.length > 0 ? (
            <>
              <p className="px-3 pt-2.5 pb-1 text-xs font-medium text-muted uppercase tracking-wide">
                Existing categories
              </p>
              {presets.map((preset) => {
                const styles = colorStyles(preset.display_color)
                const isUsed = usedCategoryNames.has(preset.name.toLowerCase())
                return (
                  <div key={preset.id} className="flex items-center gap-1 px-3 py-2 hover:bg-surface-muted transition-colors">
                    <button
                      type="button"
                      onClick={() => { if (!isUsed) { onSelectPreset(preset); setOpen(false) } }}
                      disabled={isUsed}
                      className="flex-1 flex items-center gap-2.5 text-sm text-left disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
                        {preset.name}
                      </span>
                      <span className="text-xs text-muted capitalize">{preset.technician_role}s</span>
                    </button>
                  </div>
                )
              })}
            </>
          ) : (
            <p className="px-3 py-3 text-xs text-muted">No presets yet. Create one via Category Presets.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create Category Inline Form ──────────────────────────────────────────────
export function CreateCategoryForm({
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  onSubmit: (name: string, role: "detailer" | "installer", color: string) => void
  onCancel: () => void
  submitting: boolean
  error: string
}) {
  const [name, setName]       = useState("")
  const [role, setRole]       = useState<"detailer" | "installer">("detailer")
  const [color, setColor]     = useState("blue")
  const [nameErr, setNameErr] = useState("")

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr("Name is required."); return }
    onSubmit(name.trim(), role, color)
  }

  return (
    <div className="border border-primary/20 rounded-card p-4 bg-primary/5 space-y-3">
      <p className="text-xs font-semibold text-body">New category</p>

      <div className="space-y-1">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr("") }}
          placeholder="Category name (e.g. Quality Check)"
          className={`w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-surface ${nameErr ? "border-status-delayed" : "border-border"}`}
        />
        {nameErr && <p className="text-xs text-status-delayed">{nameErr}</p>}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-body shrink-0">Assigned to:</p>
        <div className="flex gap-1.5">
          {(["detailer", "installer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                role === r ? "bg-primary text-white" : "bg-surface border border-border text-body hover:border-primary/40"
              }`}
            >
              {r === "detailer" ? "Detailers" : "Installers"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-body shrink-0">Badge color:</p>
        <div className="flex gap-1.5 flex-wrap">
          {COLOR_OPTIONS.map((c) => {
            const styles = colorStyles(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`px-2 py-0.5 text-xs rounded-full font-medium transition-all ${styles.badge} ${color === c ? "ring-2 ring-offset-1 ring-gray-400" : "opacity-70 hover:opacity-100"}`}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      {error && <p className="text-xs text-status-delayed">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-sm hover:bg-shell-alt disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating..." : "Create & Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-muted rounded-sm transition-colors"
        >
          <X className="w-3.5 h-3.5 inline mr-1" />
          Cancel
        </button>
      </div>
    </div>
  )
}
