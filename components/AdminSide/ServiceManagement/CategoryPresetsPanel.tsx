"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Pencil, Trash2, Plus, ShieldCheck } from "lucide-react"
import { COLOR_OPTIONS, colorStyles, minsToHHMM, hhmmToMins } from "./service-form-helpers"
import { Drawer } from "@/components/ui/Drawer"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { HourMinuteInput } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { FieldHint } from "@/components/ui/FieldHint"
import { findDuplicateStageIds } from "@/lib/admin/service-stage-validation"

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
  const [serverError, setServerError] = useState<string | null>(null)
  const toast = useToast()

  // Confirmation before Save (Create/Update) and Delete — neither ran
  // through any confirmation before.
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CategoryPreset | null>(null)

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
    if (ok) toast.success(msg)
    else toast.error(msg)
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

    const duplicateKeys = findDuplicateStageIds(fStages.map((s) => ({ id: s.key, name: s.name })))

    const newStageErrors: Record<string, { name?: string; dur?: string }> = {}
    fStages.forEach((s) => {
      const errs: { name?: string; dur?: string } = {}
      if (!s.name.trim()) errs.name = "Stage name is required."
      else if (duplicateKeys.has(s.key)) errs.name = "Another stage already has this name."
      if (stageRowToMins(s) < 1) errs.dur = "Duration must be at least 1 minute."
      if (errs.name || errs.dur) { newStageErrors[s.key] = errs; valid = false }
    })
    setStageErrors(newStageErrors)

    return valid
  }

  function handleSaveClick() {
    if (!validate()) return
    setServerError(null)
    setSaveConfirmOpen(true)
  }

  async function handleSave() {
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
      if (!res.ok) { setServerError(json.error ?? "Failed to save preset."); setSaveConfirmOpen(false); return }

      setSaveConfirmOpen(false)
      await fetchPresets()
      setMode("list")
      showToast(mode === "edit" ? "Preset updated." : "Preset created.", true)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { id, name } = deleteTarget
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
      setDeleteTarget(null)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="md"
      title={
        <span className="flex items-center gap-2">
          {mode !== "list" && (
            <button
              onClick={() => { setMode("list"); clearErrors() }}
              className="-ml-1 rounded-sm p-1 text-body transition-colors hover:bg-surface-muted"
              aria-label="Back to list"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          {mode === "list" ? "Manage Category Presets" : mode === "create" ? "New Preset" : "Edit Preset"}
        </span>
      }
      description={mode === "list" ? "Reusable templates for workflow categories" : undefined}
      headerActions={
        mode === "list" ? (
          <Button variant="secondary" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New Preset
          </Button>
        ) : undefined
      }
      footer={
        mode === "create" || mode === "edit" ? (
          <>
            <Button variant="ghost" onClick={() => { setMode("list"); clearErrors() }}>
              Cancel
            </Button>
            <Button onClick={handleSaveClick} disabled={saving}>
              {saving ? "Saving…" : mode === "edit" ? "Update Preset" : "Save Preset"}
            </Button>
          </>
        ) : undefined
      }
    >
        <div className="-mx-5 -my-4">
          {/* ─── LIST VIEW ─── */}
          {mode === "list" && (
            <div className="p-5 space-y-3">
              {loading ? (
                <p className="text-center text-sm text-muted py-8">Loading...</p>
              ) : presets.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-center text-sm text-muted py-4">No presets yet. Create your first one.</p>
                  <button
                    onClick={openCreate}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-card border-2 border-dashed border-border text-sm text-body hover:border-primary/40 hover:text-body transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Preset
                  </button>
                </div>
              ) : (
                presets.map((preset) => {
                  const cs = colorStyles(preset.display_color)
                  return (
                    <div key={preset.id} className="border border-border-subtle rounded-card p-4 space-y-3 hover:border-border transition-colors">
                      {/* Top row: badge + role + actions */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cs.badge}`}>
                            {preset.name}
                          </span>
                          <p className="text-xs text-muted">
                            Assigned to: <span className="font-medium text-body">{ROLE_LABELS[preset.technician_role]}</span>
                            {" · "}
                            <span className="font-medium text-body">{preset.stages.length} {preset.stages.length === 1 ? "stage" : "stages"}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(preset)}
                            title="Edit preset"
                            className="p-1.5 rounded-sm hover:bg-surface-muted text-muted hover:text-body transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(preset)}
                            disabled={deletingId === preset.id}
                            title="Delete preset"
                            className="p-1.5 rounded-sm hover:bg-status-delayed/10 text-muted hover:text-status-delayed transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Stages */}
                      {preset.stages.length > 0 && (
                        <div className="space-y-1 pl-1">
                          {preset.stages.map((stage) => (
                            <div key={stage.id ?? stage.sequence_order} className="flex items-center gap-2 text-xs text-body">
                              <span className="font-medium text-muted w-4 shrink-0">{stage.sequence_order}.</span>
                              <span className="flex-1 text-body">{stage.name}</span>
                              <span className="text-muted shrink-0">{formatStageDuration(stage.stage_duration_mins)}</span>
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
              <div className="relative group space-y-1.5">
                <label className="text-xs font-semibold text-body uppercase tracking-wide">
                  Preset Name <span className="text-status-delayed">*</span>
                </label>
                <input
                  type="text"
                  value={fName}
                  onChange={(e) => { setFName(e.target.value); if (nameError) setNameError("") }}
                  placeholder="e.g. Quality Check"
                  className={`w-full px-3 py-2.5 text-sm border rounded-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                    nameError ? "border-status-delayed bg-status-delayed/10" : "border-border"
                  }`}
                />
                <FieldHint>Any characters allowed. Must be unique (case and spacing don&apos;t count).</FieldHint>
                {nameError && <p className="text-xs text-status-delayed">{nameError}</p>}
              </div>

              {/* Assigned Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-body uppercase tracking-wide">
                  Assigned to <span className="text-status-delayed">*</span>
                </label>
                <div className="flex gap-2">
                  {(["detailer", "installer"] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setFRole(role)}
                      className={`px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
                        fRole === role
                          ? "bg-primary text-white border-primary"
                          : "bg-surface text-body border-border hover:border-primary/40"
                      }`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stages */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-body uppercase tracking-wide">
                  Stages <span className="text-status-delayed">*</span>
                </label>
                {stagesError && <p className="text-xs text-status-delayed">{stagesError}</p>}
                <div className="space-y-2">
                  {fStages.map((stage, idx) => {
                    const stageErr = stageErrors[stage.key]
                    return (
                      <div key={stage.key} className="space-y-1 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted w-5 shrink-0 text-right">{idx + 1}.</span>
                          <div className="relative group flex-1 min-w-0">
                            <input
                              type="text"
                              value={stage.name}
                              onChange={(e) => updateStage(stage.key, "name", e.target.value)}
                              placeholder="Stage name"
                              className={`w-full px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors ${
                                stageErr?.name ? "border-status-delayed bg-status-delayed/10" : "border-border"
                              }`}
                            />
                            <FieldHint>Stage names must be unique within this preset. Any characters allowed.</FieldHint>
                          </div>
                          <HourMinuteInput
                            hours={parseInt(stage.hh, 10) || 0}
                            minutes={parseInt(stage.mm, 10) || 0}
                            onChange={(hh, mm) => {
                              updateStage(stage.key, "hh", String(hh).padStart(2, "0").slice(-2))
                              updateStage(stage.key, "mm", String(mm).padStart(2, "0").slice(-2))
                            }}
                            ariaLabelPrefix={`Stage ${idx + 1}`}
                            invalid={!!stageErr?.dur}
                            size="md"
                          />
                          <button
                            onClick={() => removeStage(stage.key)}
                            disabled={fStages.length === 1}
                            className="p-1.5 rounded-sm hover:bg-status-delayed/10 text-muted hover:text-status-delayed transition-colors disabled:opacity-20 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {(stageErr?.name || stageErr?.dur) && (
                          <div className="pl-7 space-y-0.5">
                            {stageErr.name && <p className="text-xs text-status-delayed">{stageErr.name}</p>}
                            {stageErr.dur  && <p className="text-xs text-status-delayed">{stageErr.dur}</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button
                  onClick={addStage}
                  className="flex items-center gap-1.5 text-sm text-body hover:text-body transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stage
                </button>
              </div>

              {serverError && <p className="text-sm text-status-delayed">{serverError}</p>}

              <p className="text-xs text-muted"><span className="text-status-delayed">*</span> Required field</p>
            </div>
          )}
        </div>

    <ConfirmModal
      open={saveConfirmOpen}
      onClose={() => !saving && setSaveConfirmOpen(false)}
      onConfirm={handleSave}
      title={mode === "edit" ? "Update preset?" : "Create preset?"}
      message={
        mode === "edit"
          ? `Save changes to "${fName.trim()}"?`
          : `Create the preset "${fName.trim()}" with ${fStages.length} stage${fStages.length === 1 ? "" : "s"}?`
      }
      confirmLabel={saving ? "Saving…" : mode === "edit" ? "Update" : "Create"}
      loading={saving}
      icon={ShieldCheck}
    />

    <ConfirmModal
      open={deleteTarget !== null}
      onClose={() => !deletingId && setDeleteTarget(null)}
      onConfirm={handleDelete}
      title="Delete preset?"
      message={`Delete "${deleteTarget?.name ?? "this preset"}"? Services already using it keep their existing stages.`}
      confirmLabel={deletingId ? "Deleting…" : "Delete"}
      tone="danger"
      loading={deletingId !== null}
      icon={Trash2}
    />
    </Drawer>
  )
}
