"use client"

import { useEffect, useRef, useState } from "react"
import { GripVertical, Trash2, Pencil, Plus, ChevronDown, ChevronUp, Check, X } from "lucide-react"

export const SERVICE_TYPES = [
  "Paint Protection Film",
  "Coating Services",
  "Auto Detailing",
  "Nano Ceramic Tint",
] as const

export type ServiceType = typeof SERVICE_TYPES[number]

export interface Stage {
  id: string
  name: string
  dbId?: string
}

export interface WorkflowCategory {
  id: string
  name: string
  technician_role: "detailer" | "installer"
  display_color: string
}

export interface CategorySection {
  categoryId: string
  categoryName: string
  technicianRole: "detailer" | "installer"
  displayColor: string
  stages: Stage[]
  dragIndex: React.MutableRefObject<number | null>
}

export const COLOR_STYLES: Record<string, { badge: string; button: string }> = {
  blue:    { badge: "text-blue-700 bg-blue-50",       button: "text-blue-600 hover:text-blue-700" },
  purple:  { badge: "text-purple-700 bg-purple-50",   button: "text-purple-600 hover:text-purple-700" },
  emerald: { badge: "text-emerald-700 bg-emerald-50", button: "text-emerald-600 hover:text-emerald-700" },
  orange:  { badge: "text-orange-700 bg-orange-50",   button: "text-orange-600 hover:text-orange-700" },
  rose:    { badge: "text-rose-700 bg-rose-50",       button: "text-rose-600 hover:text-rose-700" },
  teal:    { badge: "text-teal-700 bg-teal-50",       button: "text-teal-600 hover:text-teal-700" },
  yellow:  { badge: "text-yellow-700 bg-yellow-50",   button: "text-yellow-600 hover:text-yellow-700" },
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
  onChange,
  error,
}: {
  value: string
  onChange: (v: ServiceType) => void
  error?: string
}) {
  const [open, setOpen]     = useState(false)
  const [query, setQuery]   = useState("")
  const containerRef        = useRef<HTMLDivElement>(null)
  const inputRef            = useRef<HTMLInputElement>(null)

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

  const displayValue = open ? query : value

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center border rounded-lg transition-colors ${
          error ? "border-red-400 bg-red-50" : open ? "border-blue-400 ring-2 ring-blue-100" : "border-gray-200"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); setQuery("") }}
          placeholder="Select service type..."
          className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none"
          readOnly={!open}
        />
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (!open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0) }
          }}
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
                onClick={() => { onChange(type); setOpen(false); setQuery("") }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors"
              >
                <span className={value === type ? "text-gray-900 font-medium" : "text-gray-700"}>{type}</span>
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
export function StageList({
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
            <span className="text-sm text-gray-400 w-5 shrink-0 text-right">{index + 1}.</span>

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

// ─── Add Category Dropdown ────────────────────────────────────────────────────
export function AddCategoryDropdown({
  globalCategories,
  usedCategoryIds,
  onSelect,
  onCreateNew,
}: {
  globalCategories: WorkflowCategory[]
  usedCategoryIds: Set<string>
  onSelect: (cat: WorkflowCategory) => void
  onCreateNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const available = globalCategories.filter((c) => !usedCategoryIds.has(c.id))

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Category Section
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-100 rounded-xl shadow-lg z-20 overflow-hidden">
          {available.length > 0 && (
            <>
              <p className="px-3 pt-2.5 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Existing categories
              </p>
              {available.map((cat) => {
                const styles = colorStyles(cat.display_color)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { onSelect(cat); setOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
                      {cat.name}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{cat.technician_role}s</span>
                  </button>
                )
              })}
              <div className="border-t border-gray-100 my-1" />
            </>
          )}
          <button
            type="button"
            onClick={() => { onCreateNew(); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left text-blue-600 hover:bg-blue-50 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create new category
          </button>
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setNameErr("Name is required."); return }
    onSubmit(name.trim(), role, color)
  }

  return (
    <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/40 space-y-3">
      <p className="text-xs font-semibold text-gray-700">New category</p>

      <div className="space-y-1">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameErr("") }}
          placeholder="Category name (e.g. Quality Check)"
          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white ${nameErr ? "border-red-400" : "border-gray-200"}`}
        />
        {nameErr && <p className="text-xs text-red-500">{nameErr}</p>}
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500 shrink-0">Assigned to:</p>
        <div className="flex gap-1.5">
          {(["detailer", "installer"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                role === r ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {r === "detailer" ? "Detailers" : "Installers"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-gray-500 shrink-0">Badge color:</p>
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

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating..." : "Create & Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5 inline mr-1" />
          Cancel
        </button>
      </div>
    </div>
  )
}
