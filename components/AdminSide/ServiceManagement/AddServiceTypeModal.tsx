"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2, Pencil, Check, X, Plus, Loader2, ShieldCheck } from "lucide-react"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { FieldHint } from "@/components/ui/FieldHint"
import { statusStyle } from "@/lib/ui/status"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (newType: string) => void
}

interface ServiceTypeRow {
  name:  string
  color: string
}

type PendingAction =
  | { kind: "create"; name: string }
  | { kind: "rename"; from: string; to: string }
  | { kind: "delete"; name: string }

export default function AddServiceTypeModal({ open, onClose, onSuccess }: Props) {
  const [types, setTypes]           = useState<ServiceTypeRow[]>([])
  const [loadingList, setLoadList]  = useState(true)

  const [newName, setNewName]       = useState("")
  const [addError, setAddError]     = useState("")

  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue]     = useState("")
  const [editError, setEditError]     = useState("")

  const [pending, setPending]       = useState<PendingAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState("")

  const fetchTypes = useCallback(async () => {
    setLoadList(true)
    try {
      const res  = await fetch("/api/admin/service-types")
      const json = await res.json()
      const names: string[]                   = json.types    ?? []
      const colorMap: Record<string, string>  = json.colorMap ?? {}
      setTypes(names.map((name) => ({ name, color: colorMap[name] ?? "blue" })))
    } finally {
      setLoadList(false)
    }
  }, [])

  useEffect(() => { if (open) fetchTypes() }, [open, fetchTypes])

  function startAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) { setAddError("Name is required."); return }
    setAddError("")
    setConfirmError("")
    setPending({ kind: "create", name: trimmed })
  }

  function startEdit(name: string) {
    setEditingName(name)
    setEditValue(name)
    setEditError("")
  }

  function cancelEdit() {
    setEditingName(null)
    setEditValue("")
    setEditError("")
  }

  function startRename(from: string) {
    const trimmed = editValue.trim()
    if (!trimmed) { setEditError("Name is required."); return }
    if (trimmed === from) { cancelEdit(); return }
    setEditError("")
    setConfirmError("")
    setPending({ kind: "rename", from, to: trimmed })
  }

  function startDelete(name: string) {
    setConfirmError("")
    setPending({ kind: "delete", name })
  }

  async function runPending() {
    if (!pending) return
    setSubmitting(true)
    setConfirmError("")
    try {
      if (pending.kind === "create") {
        const res  = await fetch("/api/admin/service-types", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: pending.name }),
        })
        const json = await res.json()
        if (!res.ok) { setConfirmError(json.error ?? "Failed to create service type."); return }
        setNewName("")
        onSuccess(pending.name)
        await fetchTypes()
      } else if (pending.kind === "rename") {
        const res  = await fetch(`/api/admin/service-types/${encodeURIComponent(pending.from)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name: pending.to }),
        })
        const json = await res.json()
        if (!res.ok) { setConfirmError(json.error ?? "Failed to rename service type."); return }
        cancelEdit()
        await fetchTypes()
      } else {
        const res  = await fetch(`/api/admin/service-types/${encodeURIComponent(pending.name)}`, { method: "DELETE" })
        const json = await res.json()
        if (!res.ok) {
          const detail = json.affectedServices?.length
            ? ` Used by: ${json.affectedServices.slice(0, 3).join(", ")}${json.affectedServices.length > 3 ? "…" : ""}.`
            : ""
          setConfirmError((json.error ?? "Delete failed.") + detail)
          return
        }
        setTypes((prev) => prev.filter((t) => t.name !== pending.name))
      }
      setPending(null)
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setNewName("")
    setAddError("")
    cancelEdit()
    setTypes([])
    onClose()
  }

  const confirmCopy = pending?.kind === "create"
    ? { title: "Create service type?", message: `Add "${pending.name}" as a service type?`, confirmLabel: "Create", tone: "primary" as const, icon: ShieldCheck }
    : pending?.kind === "rename"
      ? { title: "Rename service type?", message: `Rename "${pending.from}" to "${pending.to}"? Every service using it will be updated.`, confirmLabel: "Rename", tone: "primary" as const, icon: Pencil }
      : pending?.kind === "delete"
        ? { title: "Delete service type?", message: `Delete "${pending.name}"? Services using this type must be reassigned first.`, confirmLabel: "Delete", tone: "danger" as const, icon: Trash2 }
        : null

  return (
    <Modal open={open} onClose={handleClose} title="Manage Service Types" size="md">
        {/* Add new type form */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-body">Add New Type</p>

          <form onSubmit={startAdd} className="flex gap-2">
            <div className="relative group flex-1 space-y-1">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError("") }}
                placeholder="e.g. Paint Protection Film"
                className={`w-full rounded-sm border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                  addError ? "border-status-delayed bg-status-delayed/10" : "border-border"
                }`}
              />
              <FieldHint>Any characters allowed. Duplicates are blocked regardless of capitalization or spacing.</FieldHint>
              {addError && <p className="text-xs text-status-delayed">{addError}</p>}
            </div>
            <Button type="submit">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </form>
        </div>

        {/* List */}
        <div className="mt-3 border-t border-border-subtle pt-4">
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : types.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No service types yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {types.map((t) => (
                  <li key={t.name} className="rounded-sm border border-border-subtle overflow-hidden">
                    {editingName === t.name ? (
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className="relative group flex-1">
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onChange={(e) => { setEditValue(e.target.value); setEditError("") }}
                            onKeyDown={(e) => { if (e.key === "Enter") startRename(t.name); if (e.key === "Escape") cancelEdit() }}
                            className={`w-full rounded-sm border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                              editError ? "border-status-delayed bg-status-delayed/10" : "border-border"
                            }`}
                          />
                          <FieldHint>Any characters allowed. Must be unique (case and spacing don&apos;t count).</FieldHint>
                        </div>
                        <button
                          type="button"
                          onClick={() => startRename(t.name)}
                          className={`rounded p-1 ${
                            editValue.trim() && editValue.trim() !== t.name
                              ? "bg-status-inspection text-white hover:bg-status-inspection/90"
                              : "text-muted hover:bg-surface-muted"
                          }`}
                          aria-label="Save name"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded p-1 text-muted hover:bg-surface-muted"
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-muted transition-colors">
                        <Badge className={statusStyle("release").soft}>{t.name}</Badge>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(t.name)}
                            title="Rename"
                            className="rounded p-1 text-muted transition-colors hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startDelete(t.name)}
                            title="Delete"
                            className="rounded p-1 text-muted transition-colors hover:text-status-delayed"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    {editingName === t.name && editError && (
                      <p className="px-3 pb-2 text-xs text-status-delayed">{editError}</p>
                    )}
                  </li>
              ))}
            </ul>
          )}
        </div>

        {confirmCopy && (
          <ConfirmModal
            open={pending !== null}
            onClose={() => !submitting && setPending(null)}
            onConfirm={runPending}
            title={confirmCopy.title}
            message={
              confirmError ? (
                <>
                  <span>{confirmCopy.message}</span>
                  <span className="mt-2 block text-status-delayed">{confirmError}</span>
                </>
              ) : (
                confirmCopy.message
              )
            }
            confirmLabel={submitting ? "Working…" : confirmCopy.confirmLabel}
            tone={confirmCopy.tone}
            loading={submitting}
            icon={confirmCopy.icon}
          />
        )}
    </Modal>
  )
}
