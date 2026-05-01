"use client"

import { useCallback, useEffect, useState } from "react"
import { X, Trash2, AlertTriangle, Plus, Loader2 } from "lucide-react"

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

  if (!open) return null

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Manage Service Types</h2>
          <button type="button" onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1 px-6 py-3">
          {loadingList ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : types.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No service types yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {types.map((t) => (
                  <li key={t.name} className="rounded-lg border border-gray-100 overflow-hidden">
                    {t.confirming ? (
                      <div className="px-3 py-2.5 bg-red-50 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <p className="text-xs font-semibold text-red-700 truncate">Delete &ldquo;{t.name}&rdquo;?</p>
                        </div>
                        <p className="text-xs text-red-500">Services using this type must be reassigned first.</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(t.name)}
                            disabled={t.deleting}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            {t.deleting ? "Deleting…" : "Yes, Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelConfirm}
                            className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700">
                          {t.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => confirmDelete(t.name)}
                          className="p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {t.error && (
                      <div className="px-3 pb-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-500">{t.error}</p>
                      </div>
                    )}
                  </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add new type form */}
        <div className="border-t border-gray-100 px-6 py-4 space-y-3">
          <p className="text-xs font-medium text-gray-600">Add New Type</p>

          {/* Name input + add button */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="flex-1 space-y-1">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setAddError("") }}
                placeholder="e.g. Paint Protection Film"
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors ${
                  addError ? "border-red-400 bg-red-50" : "border-gray-200"
                }`}
              />
              {addError && <p className="text-xs text-red-500">{addError}</p>}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          </form>

          <p className="text-xs text-gray-400">
            Duplicates are blocked regardless of capitalization or spacing.
          </p>
        </div>

      </div>
    </div>
  )
}
