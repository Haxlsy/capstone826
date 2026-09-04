"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2, AlertTriangle, Plus, Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { statusStyle } from "@/lib/ui/status"

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (newType: string) => void
}

interface ServiceTypeRow {
  name:      string
  color:     string
  deleting?: boolean
  error?:    string
  confirming?: boolean
}

export default function AddServiceTypeModal({ open, onClose, onSuccess }: Props) {
  const [types, setTypes]           = useState<ServiceTypeRow[]>([])
  const [loadingList, setLoadList]  = useState(true)

  const [newName, setNewName]       = useState("")
  const [addError, setAddError]     = useState("")
  const [submitting, setSubmitting] = useState(false)

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


  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newName.trim()
    if (!trimmed) { setAddError("Name is required."); return }

    setSubmitting(true)
    setAddError("")
    try {
      const res  = await fetch("/api/admin/service-types", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: trimmed }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? "Failed to create service type."); return }
      setNewName("")
      onSuccess(trimmed)
      await fetchTypes()
    } finally {
      setSubmitting(false)
    }
  }

  function confirmDelete(name: string) {
    setTypes((prev) => prev.map((t) => ({ ...t, confirming: t.name === name, error: undefined })))
  }

  function cancelConfirm() {
    setTypes((prev) => prev.map((t) => ({ ...t, confirming: false, error: undefined })))
  }

  async function handleDelete(name: string) {
    setTypes((prev) => prev.map((t) => t.name === name ? { ...t, deleting: true, error: undefined } : t))
    try {
      const res  = await fetch(`/api/admin/service-types/${encodeURIComponent(name)}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) {
        const detail = json.affectedServices?.length
          ? ` Used by: ${json.affectedServices.slice(0, 3).join(", ")}${json.affectedServices.length > 3 ? "…" : ""}.`
          : ""
        setTypes((prev) =>
          prev.map((t) => t.name === name
            ? { ...t, deleting: false, confirming: false, error: (json.error ?? "Delete failed.") + detail }
            : t
          )
        )
        return
      }
      setTypes((prev) => prev.filter((t) => t.name !== name))
    } catch {
      setTypes((prev) => prev.map((t) => t.name === name ? { ...t, deleting: false, error: "Delete failed." } : t))
    }
  }

  function handleClose() {
    setNewName("")
    setAddError("")
    setTypes([])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Manage Service Types" size="md">
        {/* List */}
        <div className="py-1">
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
                    {t.confirming ? (
                      <div className="px-3 py-2.5 bg-status-delayed/10 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-status-delayed shrink-0" />
                          <p className="text-xs font-semibold text-status-delayed truncate">Delete &ldquo;{t.name}&rdquo;?</p>
                        </div>
                        <p className="text-xs text-status-delayed">Services using this type must be reassigned first.</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(t.name)}
                            disabled={t.deleting}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-sm bg-status-delayed text-white hover:brightness-95 disabled:opacity-50 transition-colors"
                          >
                            {t.deleting ? "Deleting…" : "Yes, Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelConfirm}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-sm bg-surface border border-border text-body hover:bg-surface-muted transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-muted transition-colors">
                        <Badge className={statusStyle("release").soft}>{t.name}</Badge>
                        <button
                          type="button"
                          onClick={() => confirmDelete(t.name)}
                          className="rounded p-1 text-muted transition-colors hover:text-status-delayed"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {t.error && (
                      <div className="px-3 pb-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-status-delayed shrink-0 mt-0.5" />
                        <p className="text-xs text-status-delayed">{t.error}</p>
                      </div>
                    )}
                  </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add new type form */}
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-4">
          <p className="text-xs font-medium text-body">Add New Type</p>

          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="flex-1 space-y-1">
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
              {addError && <p className="text-xs text-status-delayed">{addError}</p>}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add
            </Button>
          </form>

          <p className="text-xs text-muted">
            Duplicates are blocked regardless of capitalization or spacing.
          </p>
        </div>
    </Modal>
  )
}
