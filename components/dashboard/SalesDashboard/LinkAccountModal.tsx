"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, User } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input, FieldLabel } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"

interface CustomerRecordOption {
  id:             string
  full_name:      string
  plate_number:   string
  vehicle_unit:   string
  contact_number: string
  psid:           string | null
}

interface LinkAccountModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fills and locks the PSID field when the caller already knows it
   *  (e.g. opened from an Inquiry). Omit to let Sales type/paste one. */
  psid?: string
  /** Pre-selects a specific record when opened from that record's row
   *  (e.g. the Customer Records page). Still changeable via search. */
  initialRecordId?: string
  onLinked?: (recordId: string, psid: string) => void
}

// Replaces the old inline "paste the PSID into a record row" workflow: Sales
// searches customer records (by name, plate, contact, or Job Order Code) and
// picks the right one, instead of hunting for the row to edit by hand.
export function LinkAccountModal({ open, onClose, psid, initialRecordId, onLinked }: LinkAccountModalProps) {
  const toast = useToast()
  const [psidValue, setPsidValue] = useState(psid ?? "")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<CustomerRecordOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isFirstLoad = useRef(true)

  const load = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales/customer-records?search=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (res.ok) setResults(json.records ?? [])
    } catch {
      // best-effort — leave the previous results visible
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setPsidValue(psid ?? "")
    setSearch("")
    setSelectedId(initialRecordId ?? null)
    setError(null)
    isFirstLoad.current = true
    load("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, psid, initialRecordId])

  useEffect(() => {
    if (!open) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, open, load])

  async function handleLink() {
    if (!selectedId || !psidValue.trim()) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch(`/api/sales/customer-records/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ psid: psidValue.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to link account")

      toast.success("Messenger account linked.")
      onLinked?.(selectedId, psidValue.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLinking(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Link Messenger Account"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={linking || !selectedId || !psidValue.trim()}>
            {linking ? "Linking…" : "Link Account"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel>Messenger PSID</FieldLabel>
          <Input
            value={psidValue}
            onChange={(e) => setPsidValue(e.target.value)}
            placeholder="Paste the Page-Scoped ID"
            disabled={Boolean(psid)}
            className="font-mono text-xs"
          />
        </div>

        <div>
          <FieldLabel>Search Customer Records</FieldLabel>
          <Input
            icon={<Search />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, plate, contact, or Job Order Code"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-card border border-border-subtle">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted">Loading…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">No matching customer records.</p>
          ) : (
            results.map((r) => {
              const isSelected = selectedId === r.id
              const isTaken = Boolean(r.psid) && r.psid !== psidValue.trim()
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0 transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-surface-subtle",
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-body">
                    <User className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-heading">{r.full_name}</p>
                    <p className="truncate text-xs text-muted">
                      {r.plate_number} · {r.vehicle_unit} · {r.contact_number}
                    </p>
                  </div>
                  {isTaken && (
                    <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                      Already linked
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>

        {error && <p className="text-xs text-status-delayed">{error}</p>}
      </div>
    </Modal>
  )
}
