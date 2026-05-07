"use client"

import { useCallback, useEffect, useState } from "react"
import { X, ArrowLeft, Pencil, Trash2, Plus, Check } from "lucide-react"
import { COLOR_OPTIONS, colorStyles, minsToHHMM, hhmmToMins } from "./service-form-helpers"

interface PresetStage {
  id?:                string
  name:               string
  sequence_order:     number
  stage_duration_mins: number
}

interface CategoryPreset {
  id:              string
  name:            string
  technician_role: "detailer" | "installer"
  display_color:   string
  stages:          PresetStage[]
}

interface StageRow {
  key:     string
  name:    string
  hh:      string
  mm:      string
}

type Mode = "list" | "create" | "edit"

const ROLE_LABELS: Record<"detailer" | "installer", string> = {
  detailer:  "Detailers",
  installer: "Installers",
}

function makeKey() { return Math.random().toString(36).slice(2) }

function blankStage(): StageRow {
  return { key: makeKey(), name: "", hh: "00", mm: "00" }
}

function stageRowToMins(s: StageRow) {
  return hhmmToMins(`${s.hh.padStart(2, "0")}:${s.mm.padStart(2, "0")}`)
}

function formatStageDuration(mins: number) {
  if (!mins) return "0m"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h)       return `${h}h`
  return `${m}m`
}

export default function CategoryPresetsPanel({
  open,
  onClose,
}: {
  open:    boolean
  onClose: () => void
}) {
  const [presets, setPresets]       = useState<CategoryPreset[]>([])
  const [loading, setLoading]       = useState(false)
  const [mode, setMode]             = useState<Mode>("list")
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  // Form state
  const [fName,  setFName]   = useState("")
  const [fRole,  setFRole]   = useState<"detailer" | "installer">("detailer")
  const [fColor, setFColor]  = useState("blue")
  const [fStages, setFStages] = useState<StageRow[]>([blankStage()])

  // Validation errors
  const [nameError,   setNameError]   = useState("")
  const [stageErrors, setStageErrors] = useState<Record<string, { name?: string; dur?: string }>>({})
  const [stagesError, setStagesError] = useState("")

  const fetchPresets = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/admin/category-presets")
      const json = await res.json()
      if (res.ok) setPresets(json.presets ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchPresets()
  }, [open, fetchPresets])

  // Reset to list when panel closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => { setMode("list"); clearErrors() }, 300)
    }
  }, [open])

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  function clearErrors() {
    setNameError(""); setStageErrors({}); setStagesError(""); setServerError(null)
  }

  function openCreate() {
    setFName(""); setFRole("detailer"); setFColor(COLOR_OPTIONS[presets.length % COLOR_OPTIONS.length])
    setFStages([blankStage()])
    setEditingId(null)
    clearErrors()
    setMode("create")
  }

  function openEdit(preset: CategoryPreset) {
    setFName(preset.name)
    setFRole(preset.technician_role)
    setFColor(preset.display_color)
    setFStages(
      preset.stages.length > 0
        ? preset.stages.map((s) => {
            const hhmm = minsToHHMM(s.stage_duration_mins)
            const [hh, mm] = hhmm.split(":")
            return { key: makeKey(), name: s.name, hh, mm }
          })
        : [blankStage()]
    )
    setEditingId(preset.id)
    clearErrors()
    setMode("edit")
  }

  function addStage() {
    setFStages((prev) => [...prev, blankStage()])
  }

  function removeStage(key: string) {
    setFStages((prev) => prev.filter((s) => s.key !== key))
  }

  function updateStage(key: string, field: keyof Omit<StageRow, "key">, value: string) {
    setFStages((prev) => prev.map((s) => s.key === key ? { ...s, [field]: value } : s))
    setStageErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      if (field === "name") delete next[key]?.name
      if (field === "hh" || field === "mm") delete next[key]?.dur
      if (!next[key]?.name && !next[key]?.dur) delete next[key]
      return next
    })
  }

  function validate(): boolean {
    let valid = true
    if (!fName.trim()) { setNameError("Preset name is required."); valid = false }
    if (fStages.length === 0) { setStagesError("At least 1 stage is required."); valid = false }

    const newStageErrors: Record<string, { name?: string; dur?: string }> = {}
    fStages.forEach((s) => {
      const errs: { name?: string; dur?: string } = {}
      if (!s.name.trim()) errs.name = "Stage name is required."
      if (stageRowToMins(s) < 1) errs.dur = "Duration must be at least 1 minute."
      if (errs.name || errs.dur) { newStageErrors[s.key] = errs; valid = false }
    })
    setStageErrors(newStageErrors)

    return valid
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setServerError(null)
    try {
      const stages = fStages.map((s) => ({ name: s.name.trim(), stage_duration_mins: stageRowToMins(s) }))

      const url    = mode === "edit" ? `/api/admin/category-presets/${editingId}` : "/api/admin/category-presets"
      const method = mode === "edit" ? "PUT" : "POST"

      const res  = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fName.trim(), technician_role: fRole, display_color: fColor, stages }),
      })
      const json = await res.json()
      if (!res.ok) { setServerError(json.error ?? "Failed to save preset."); return }

      await fetchPresets()
      setMode("list")
      showToast(mode === "edit" ? "Preset updated." : "Preset created.", true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/category-presets/${id}`, { method: "DELETE" })
      if (res.ok) {
        setPresets((prev) => prev.filter((p) => p.id !== id))
        showToast(`"${name}" deleted.`, true)
      } else {
        const json = await res.json()
        showToast(json.error ?? "Delete failed.", false)
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          {mode !== "list" && (
            <button
              onClick={() => { setMode("list"); clearErrors() }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-800">
              {mode === "list"   ? "Manage Category Presets" :
               mode === "create" ? "New Preset" : "Edit Preset"}
            </h2>
            {mode === "list" && (
              <p className="text-xs text-gray-400 mt-0.5">Reusable templates for workflow categories</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 shrink-0 ${toast.ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
            {toast.ok && <Check className="w-3.5 h-3.5 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── LIST VIEW ─── */}
          {mode === "list" && (
            <div className="p-5 space-y-3">
              <button
                onClick={openCreate}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Preset
              </button>

              {loading ? (
                <p className="text-center text-sm text-gray-400 py-8">Loading...</p>
              ) : presets.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No presets yet. Create your first one above.</p>
              ) : (
                presets.map((preset) => {
                  const cs = colorStyles(preset.display_color)
                  return (
                    <div key={preset.id} className="border border-gray-100 rounded-xl p-4 space-y-3 hover:border-gray-200 transition-colors">
                      {/* Top row: badge + role + actions */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cs.badge}`}>
                            {preset.name}
                          </span>
                          <p className="text-xs text-gray-400">
                            Assigned to: <span className="font-medium text-gray-600">{ROLE_LABELS[preset.technician_role]}</span>
                            {" · "}
                            <span className="font-medium text-gray-600">{preset.stages.length} {preset.stages.length === 1 ? "stage" : "stages"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(preset)}
                            title="Edit preset"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(preset.id, preset.name)}
                            disabled={deletingId === preset.id}
                            title="Delete preset"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Stages */}
                      {preset.stages.length > 0 && (
                        <div className="space-y-1 pl-1">
                          {preset.stages.map((stage) => (
                            <div key={stage.id ?? stage.sequence_order} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="font-medium text-gray-400 w-4 shrink-0">{stage.sequence_order}.</span>
                              <span className="flex-1 text-gray-700">{stage.name}</span>
                              <span className="text-gray-400 shrink-0">{formatStageDuration(stage.stage_duration_mins)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ─── CREATE / EDIT FORM ─── */}
          {(mode === "create" || mode === "edit") && (
            <div className="p-5 space-y-5">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Preset Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => { setFName(e.target.value); if (nameError) setNameError("") }}
                  placeholder="e.g. Quality Check"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                    nameError ? "border-red-400 bg-red-50" : "border-gray-200"
                  }`}
                />
                {nameError && <p className="text-xs text-red-500">{nameError}</p>}
              </div>

              {/* Assigned Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Assigned to <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {(["detailer", "installer"] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setFRole(role)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        fRole === role
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stages */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Stages <span className="text-red-500">*</span>
                </label>
                {stagesError && <p className="text-xs text-red-500">{stagesError}</p>}
                <div className="space-y-2">
                  {fStages.map((stage, idx) => {
                    const stageErr = stageErrors[stage.key]
                    return (
                      <div key={stage.key} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-5 shrink-0 text-right">{idx + 1}.</span>
                          <input
                            type="text"
                            value={stage.name}
                            onChange={(e) => updateStage(stage.key, "name", e.target.value)}
                            placeholder="Stage name"
                            className={`flex-1 min-w-0 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                              stageErr?.name ? "border-red-400 bg-red-50" : "border-gray-200"
                            }`}
                          />
                          <div className={`flex items-center gap-1 shrink-0 border rounded-lg overflow-hidden transition-colors ${
                            stageErr?.dur ? "border-red-400 bg-red-50" : "border-gray-200"
                          }`}>
                            <input
                              type="number"
                              min="0"
                              max="99"
                              value={stage.hh}
                              onChange={(e) => updateStage(stage.key, "hh", e.target.value.padStart(2, "0").slice(-2))}
                              className="w-12 px-2 py-2 text-sm text-center bg-transparent focus:outline-none"
                            />
                            <span className="text-gray-400 text-sm font-medium">:</span>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={stage.mm}
                              onChange={(e) => updateStage(stage.key, "mm", e.target.value.padStart(2, "0").slice(-2))}
                              className="w-12 px-2 py-2 text-sm text-center bg-transparent focus:outline-none"
                            />
                          </div>
                          <button
                            onClick={() => removeStage(stage.key)}
                            disabled={fStages.length === 1}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-20 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(stageErr?.name || stageErr?.dur) && (
                          <div className="pl-7 space-y-0.5">
                            {stageErr.name && <p className="text-xs text-red-500">{stageErr.name}</p>}
                            {stageErr.dur  && <p className="text-xs text-red-500">{stageErr.dur}</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={addStage}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stage
                </button>
              </div>

              {serverError && <p className="text-sm text-red-500">{serverError}</p>}

              <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required field</p>
            </div>
          )}
        </div>

        {/* Footer (form only) */}
        {(mode === "create" || mode === "edit") && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : mode === "edit" ? "Update Preset" : "Save Preset"}
            </button>
            <button
              onClick={() => { setMode("list"); clearErrors() }}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  )
}
