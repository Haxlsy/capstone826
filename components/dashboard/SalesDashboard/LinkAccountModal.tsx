"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Search, Car } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input } from "@/components/ui/Field"
import { Popover } from "@/components/ui/Popover"
import { useToast } from "@/components/ui/Toast"
import { getInitials } from "@/hooks/useCurrentUser"
import { groupByCustomer } from "@/lib/customer-grouping"

export interface CustomerRecordOption {
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
  /** Full data for `initialRecordId`, when the caller already has it in
   *  memory (Customer Records does) — lets the combobox show the right
   *  selection immediately without depending on that record turning up in
   *  whatever the current paginated search happens to return. */
  initialRecord?: CustomerRecordOption
  onLinked?: (recordId: string, psid: string) => void
}

function recordSubtitle(r: Pick<CustomerRecordOption, "plate_number" | "vehicle_unit" | "contact_number">) {
  return `${r.plate_number} · ${r.vehicle_unit} · ${r.contact_number}`
}

// Replaces the old inline "paste the PSID into a record row" workflow: Sales
// searches customer records (by name, plate, contact, or Job Order Code) and
// picks the right one, instead of hunting for the row to edit by hand.
export function LinkAccountModal({ open, onClose, psid, initialRecordId, initialRecord, onLinked }: LinkAccountModalProps) {
  const toast = useToast()
  const [psidValue, setPsidValue] = useState(psid ?? "")
  const [search, setSearch] = useState("")
  const [dropOpen, setDropOpen] = useState(false)
  const [results, setResults] = useState<CustomerRecordOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedLabel, setSelectedLabel] = useState<{ name: string; sub: string } | null>(null)
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
    setDropOpen(false)
    setSelectedId(initialRecordId ?? null)
    setSelectedLabel(initialRecord ? { name: initialRecord.full_name, sub: recordSubtitle(initialRecord) } : null)
    setError(null)
    isFirstLoad.current = true
    load("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, psid, initialRecordId, initialRecord])

  useEffect(() => {
    if (!open) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, open, load])

  // Grouped the same way Customer Records presents a customer with multiple
  // vehicles — one header, one row per vehicle — instead of a flat list
  // where the same name repeats once per vehicle.
  const groups = useMemo(
    () => groupByCustomer(results, (r) => r.id, (r) => r.contact_number, (r) => r.psid),
    [results],
  )

  function selectRecord(r: CustomerRecordOption) {
    setSelectedId(r.id)
    setSelectedLabel({ name: r.full_name, sub: recordSubtitle(r) })
    setSearch("")
  }

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
          <Popover
            open={dropOpen}
            onOpenChange={setDropOpen}
            matchTriggerWidth
            placement="bottom"
            panelClassName="max-h-72 overflow-y-auto p-0"
            trigger={() => (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={selectedId && !dropOpen ? selectedLabel?.name ?? "" : search}
                  onFocus={() => {
                    if (selectedId) {
                      setSelectedId(null)
                      setSelectedLabel(null)
                      setSearch("")
                    }
                    setDropOpen(true)
                  }}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setDropOpen(true)
                  }}
                  placeholder="Search by name, plate, contact, or Job Order Code"
                  className="h-10 w-full rounded-sm border border-border bg-surface pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}
          >
            {(close) =>
              loading ? (
                <p className="p-4 text-center text-sm text-muted">Loading…</p>
              ) : groups.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted">No matching customer records.</p>
              ) : (
                groups.map((group) => {
                  const isMulti = group.vehicles.length > 1

                  if (!isMulti) {
                    const r = group.primary
                    const isTaken = Boolean(r.psid) && r.psid !== psidValue.trim()
                    return (
                      <button
                        key={group.key}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { selectRecord(r); close() }}
                        className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-surface-subtle"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-body">
                          {getInitials(r.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-heading">{r.full_name}</p>
                          <p className="truncate text-xs text-muted">{recordSubtitle(r)}</p>
                        </div>
                        {isTaken && (
                          <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                            Already linked
                          </span>
                        )}
                      </button>
                    )
                  }

                  return (
                    <div key={group.key} className="border-b border-border-subtle last:border-b-0">
                      {/* Customer header — grouping label only, not itself selectable
                          since a PSID attaches to one specific vehicle record. */}
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-surface-subtle">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-bold text-body">
                          {getInitials(group.primary.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-heading">{group.primary.full_name}</p>
                          <p className="truncate text-[11px] text-muted">{group.primary.contact_number}</p>
                        </div>
                      </div>
                      {group.vehicles.map((r) => {
                        const isTaken = Boolean(r.psid) && r.psid !== psidValue.trim()
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { selectRecord(r); close() }}
                            className="flex w-full items-center gap-3 py-2.5 pl-11 pr-4 text-left transition-colors hover:bg-surface-subtle"
                          >
                            <Car className="h-3.5 w-3.5 shrink-0 text-muted" />
                            <span className="min-w-0 flex-1 truncate text-sm text-body">
                              <span className="font-mono font-medium text-heading">{r.plate_number}</span> · {r.vehicle_unit}
                            </span>
                            {isTaken && (
                              <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                                Already linked
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })
              )
            }
          </Popover>

          {selectedId && selectedLabel && !dropOpen && (
            <p className="mt-1.5 truncate text-xs text-muted">{selectedLabel.sub}</p>
          )}
        </div>

        {error && <p className="text-xs text-status-delayed">{error}</p>}
      </div>
    </Modal>
  )
}
