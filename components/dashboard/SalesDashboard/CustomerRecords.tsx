"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Car, Phone, Mail, Pencil, X, Check, ChevronDown, ChevronUp } from "lucide-react"
import { getInitials } from "@/hooks/useCurrentUser"
import { fmtDate } from "@/lib/time-display"
import { normalizePhone } from "@/lib/phone"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Field"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import { LinkAccountModal } from "./LinkAccountModal"

interface CustomerRecord {
  id: string
  fullName: string
  contactNumber: string
  email: string | null
  plateNumber: string
  vehicleUnit: string
  psid: string | null
  createdAt: string
}

interface CustomerGroup {
  key: string
  vehicles: CustomerRecord[]
  /** The record shown in the group header — whichever holds the psid, else the newest. */
  primary: CustomerRecord
}

/** Groups vehicle rows into one entry per customer, by normalized phone number
 *  — the same correlation the Messenger status flow already uses to find a
 *  customer's other vehicles, since only one row can ever hold a given psid. */
function groupByCustomer(records: CustomerRecord[]): CustomerGroup[] {
  const map = new Map<string, CustomerRecord[]>()
  for (const r of records) {
    const key = normalizePhone(r.contactNumber) || `unknown:${r.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return [...map.entries()].map(([key, vehicles]) => ({
    key,
    vehicles,
    primary: vehicles.find((v) => v.psid) ?? vehicles[0],
  }))
}

export default function CustomerRecords() {
  const toast = useToast()
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isFirstRender = useRef(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CustomerRecord>>({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const [linkTargetId, setLinkTargetId] = useState<string | null>(null)

  const load = useCallback(async (q = "") => {
    setLoading(true)
    setFetchErr(null)
    try {
      const res = await fetch(`/api/sales/customer-records${q ? `?search=${encodeURIComponent(q)}` : ""}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")
      const shaped: CustomerRecord[] = (json.records ?? []).map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        contactNumber: r.contact_number,
        email: r.email ?? null,
        plateNumber: r.plate_number,
        vehicleUnit: r.vehicle_unit,
        psid: r.psid ?? null,
        createdAt: fmtDate(r.created_at),
      }))
      setRecords(shaped)
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      load()
      return
    }
    const t = setTimeout(() => {
      load(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  // Live updates when a record is created from an inquiry or edited elsewhere.
  // Re-runs with the active search term so the visible filter is preserved.
  useRealtimeRefetch("customer_record", () => load(search))

  const groups = useMemo(() => groupByCustomer(records), [records])

  function startEdit(record: CustomerRecord) {
    setEditingId(record.id)
    setEditDraft({
      fullName: record.fullName,
      contactNumber: record.contactNumber,
      email: record.email ?? "",
      plateNumber: record.plateNumber,
      vehicleUnit: record.vehicleUnit,
    })
    setSaveErr(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
    setSaveErr(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/sales/customer-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editDraft.fullName,
          contact_number: editDraft.contactNumber,
          email: editDraft.email || null,
          plate_number: editDraft.plateNumber,
          vehicle_unit: editDraft.vehicleUnit,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save")

      setRecords((prev) =>
        prev.map((r) => (r.id === id ? ({ ...r, ...editDraft } as CustomerRecord) : r)),
      )
      setEditingId(null)
      setEditDraft({})
      toast.success("Customer record updated.")
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const editCell = "h-8 text-sm"

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Customer Records" subtitle="Confirmed customer details from booking inquiries." />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, plate, or contact…"
        containerClassName="max-w-sm"
      />

      {loading && <p className="text-sm text-muted">Loading…</p>}
      {fetchErr && <p className="text-sm text-status-delayed">{fetchErr}</p>}
      {!loading && !fetchErr && groups.length === 0 && (
        <EmptyState title="No records found." />
      )}

      <div className="flex flex-col gap-3">
        {groups.map((group) => {
          const isMulti = group.vehicles.length > 1
          const isExpanded = !isMulti || Boolean(expanded[group.key])

          return (
            <div key={group.key} className="bg-surface border border-border rounded-card overflow-hidden">
              {/* Customer header */}
              <div
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5",
                  isMulti && "cursor-pointer hover:bg-surface-muted/50 transition-colors",
                )}
                onClick={isMulti ? () => setExpanded((p) => ({ ...p, [group.key]: !p[group.key] })) : undefined}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-body">
                  {getInitials(group.primary.fullName)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-heading">{group.primary.fullName}</p>
                  {group.primary.psid ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLinkTargetId(group.primary.id) }}
                      className="font-mono text-[11px] text-muted hover:text-primary hover:underline"
                      title="Click to relink"
                    >
                      {group.primary.psid}
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLinkTargetId(group.primary.id) }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Link Messenger Account
                    </button>
                  )}
                </div>
                <span className="text-xs text-muted shrink-0">
                  {group.vehicles.length} {group.vehicles.length === 1 ? "vehicle" : "vehicles"}
                </span>
                {isMulti && (isExpanded ? <ChevronUp className="h-4 w-4 text-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted shrink-0" />)}
              </div>

              {/* Vehicle lines — each plate + vehicle unit pair, independently editable */}
              {isExpanded && (
                <div className="divide-y divide-border-subtle border-t border-border-subtle">
                  {group.vehicles.map((record) => {
                    const isEditing = editingId === record.id
                    return (
                      <div key={record.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Car className="h-3.5 w-3.5 shrink-0 text-muted" />
                          {isEditing ? (
                            <Input
                              aria-label="Plate number"
                              className={cn(editCell, "w-28")}
                              value={editDraft.plateNumber ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, plateNumber: e.target.value }))}
                            />
                          ) : (
                            <span className="font-mono font-medium text-body">{record.plateNumber}</span>
                          )}
                          {isEditing ? (
                            <Input
                              aria-label="Vehicle unit"
                              className={cn(editCell, "w-36")}
                              value={editDraft.vehicleUnit ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, vehicleUnit: e.target.value }))}
                            />
                          ) : (
                            <span className="text-body">{record.vehicleUnit}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Phone className="h-3.5 w-3.5 shrink-0 text-muted" />
                          {isEditing ? (
                            <Input
                              aria-label="Contact number"
                              className={cn(editCell, "w-36")}
                              value={editDraft.contactNumber ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, contactNumber: e.target.value }))}
                            />
                          ) : (
                            <span className="text-body">{record.contactNumber}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 min-w-[180px]">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
                          {isEditing ? (
                            <Input
                              aria-label="Email"
                              type="email"
                              className={cn(editCell, "w-44")}
                              value={editDraft.email ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                            />
                          ) : (
                            <span className="text-sm text-body">{record.email ?? <span className="text-muted">—</span>}</span>
                          )}
                        </div>

                        <span className="text-xs text-muted">{record.createdAt}</span>

                        <div className="ml-auto flex flex-col gap-1">
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => saveEdit(record.id)} disabled={saving}>
                                  <Check className="h-3.5 w-3.5" />
                                  {saving ? "Saving…" : "Save"}
                                </Button>
                                <Button size="sm" variant="subtle" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </Button>
                              </div>
                              {saveErr && <p className="text-[11px] text-status-delayed">{saveErr}</p>}
                            </>
                          ) : (
                            <Button size="sm" variant="subtle" onClick={() => startEdit(record)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <LinkAccountModal
        open={linkTargetId !== null}
        onClose={() => setLinkTargetId(null)}
        initialRecordId={linkTargetId ?? undefined}
        onLinked={(id, psid) =>
          setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, psid } : r)))
        }
      />
    </div>
  )
}
