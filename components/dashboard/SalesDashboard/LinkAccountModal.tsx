"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { FieldLabel, Input } from "@/components/ui/Field"
import { Popover } from "@/components/ui/Popover"
import { useToast } from "@/components/ui/Toast"
import { getInitials } from "@/hooks/useCurrentUser"

export interface CustomerOption {
  id:             string
  full_name:      string
  contact_number: string | null
  psid:           string | null
  /** Plate numbers of the customer's vehicles, for the subtitle. */
  plates:         string[]
}

interface LinkAccountModalProps {
  open: boolean
  onClose: () => void
  /** Pre-fills and locks the PSID field when the caller already knows it
   *  (e.g. opened from an Inquiry). Omit to let Sales type/paste one. */
  psid?: string
  /** Pre-selects a customer when opened from that customer's header
   *  (the Customer Records page). Still changeable via search. */
  initialCustomer?: CustomerOption
  onLinked?: (customerId: string, psid: string) => void
}

function customerSubtitle(c: Pick<CustomerOption, "contact_number" | "plates">) {
  return [c.contact_number, c.plates.join(", ")].filter(Boolean).join(" · ")
}

// Sales searches customers (by name, plate, contact, or Job Order ID) and picks
// the right person. The Messenger account attaches to the CUSTOMER — all of
// their vehicles are reached through it.
export function LinkAccountModal({ open, onClose, psid, initialCustomer, onLinked }: LinkAccountModalProps) {
  const toast = useToast()
  const [psidValue, setPsidValue] = useState(psid ?? "")
  const [search, setSearch] = useState("")
  const [dropOpen, setDropOpen] = useState(false)
  const [results, setResults] = useState<CustomerOption[]>([])
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
      if (res.ok) {
        setResults(
          (json.customers ?? []).map((c: { id: string; full_name: string; contact_number: string | null; psid: string | null; vehicles: { plate_number: string }[] }) => ({
            id: c.id,
            full_name: c.full_name,
            contact_number: c.contact_number,
            psid: c.psid,
            plates: (c.vehicles ?? []).map((v) => v.plate_number),
          })),
        )
      }
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
    setSelectedId(initialCustomer?.id ?? null)
    setSelectedLabel(initialCustomer ? { name: initialCustomer.full_name, sub: customerSubtitle(initialCustomer) } : null)
    setError(null)
    isFirstLoad.current = true
    load("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, psid, initialCustomer])

  useEffect(() => {
    if (!open) return
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, open, load])

  function selectCustomer(c: CustomerOption) {
    setSelectedId(c.id)
    setSelectedLabel({ name: c.full_name, sub: customerSubtitle(c) })
    setSearch("")
  }

  async function handleLink() {
    if (!selectedId || !psidValue.trim()) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch(`/api/sales/customers/${selectedId}`, {
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
          <FieldLabel>Search Customers</FieldLabel>
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
                  placeholder="Search by name, plate, contact, or Job Order ID"
                  className="h-10 w-full rounded-sm border border-border bg-surface pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            )}
          >
            {(close) =>
              loading ? (
                <p className="p-4 text-center text-sm text-muted">Loading…</p>
              ) : results.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted">No matching customers.</p>
              ) : (
                results.map((c) => {
                  const isTaken = Boolean(c.psid) && c.psid !== psidValue.trim()
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { selectCustomer(c); close() }}
                      className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-surface-subtle"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-body">
                        {getInitials(c.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-heading">{c.full_name}</p>
                        <p className="truncate text-xs text-muted">{customerSubtitle(c)}</p>
                      </div>
                      {isTaken && (
                        <span className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-semibold text-status-warning">
                          Already linked
                        </span>
                      )}
                    </button>
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
