"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Car, Phone, Mail, Pencil, X, Check, ChevronDown, ChevronUp, Lock, Trash2, FileText, FileSpreadsheet } from "lucide-react"
import { getInitials } from "@/hooks/useCurrentUser"
import { fmtDate } from "@/lib/time-display"
import { dateRangeError, dateRangeLabel } from "@/lib/sales/customer-records-filter"
import { groupByCustomer } from "@/lib/customer-grouping"
import { EMAIL_PATTERN } from "@/lib/messenger/patterns"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Button } from "@/components/ui/Button"
import { Input, FieldLabel } from "@/components/ui/Field"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { useToast } from "@/components/ui/Toast"
import { ConfirmModal } from "@/components/ui/Modal"
import { useOfflineLock } from "@/hooks/useOfflineLock"
import { cn } from "@/lib/utils"
import { LinkAccountModal } from "./LinkAccountModal"
import { lockedEditMessage, deleteBlockedMessage, deleteConfirmMessage } from "@/lib/sales/customer-record-lock"
import { buildCsv, downloadCsv, openPrintPreview } from "@/lib/export/print"
import { EXPORT_HEADERS, toCsvCells, exportFilename, buildPrintHtml } from "@/lib/sales/customer-records-export"
import { CustomerRecordsListSkeleton } from "@/app/dashboard/sales/customer-records/loading"

interface CustomerRecord {
  id: string
  fullName: string
  contactNumber: string
  email: string | null
  plateNumber: string
  vehicleUnit: string
  psid: string | null
  createdAt: string
  /** job_order_code of the active job order this vehicle is linked to, if any. */
  activeJobOrderCode: string | null
}


const PAGE_SIZE = 20
// The API caps a page at 100; exports page through it at that size.
const EXPORT_PAGE_SIZE = 100

export default function CustomerRecords() {
  const toast = useToast()
  const { isOnline, lockProps } = useOfflineLock()
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  // Date-added filter: the pending* values follow the inputs; the applied ones
  // (set by Apply Filters) drive the list and both exports.
  const [pendingFrom, setPendingFrom] = useState("")
  const [pendingTo, setPendingTo] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [dateErr, setDateErr] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isFirstRender = useRef(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CustomerRecord>>({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const [linkTargetId, setLinkTargetId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [exportConfirm, setExportConfirm] = useState<"pdf" | "excel" | null>(null)
  const [exporting, setExporting] = useState(false)

  function shapeRecords(raw: any[]): CustomerRecord[] {
    return raw.map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      contactNumber: r.contact_number,
      email: r.email ?? null,
      plateNumber: r.plate_number,
      vehicleUnit: r.vehicle_unit,
      psid: r.psid ?? null,
      createdAt: fmtDate(r.created_at),
      activeJobOrderCode: r.active_job_order_code ?? null,
    }))
  }

  // Fetches the first page for a (possibly new) search term, replacing
  // whatever's currently shown — the lazy-loaded pages beyond it are handled
  // by loadMore() below.
  const load = useCallback(async (q = "", from = "", to = "") => {
    setLoading(true)
    setFetchErr(null)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (q) params.set("search", q)
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")
      setRecords(shapeRecords(json.records ?? []))
      setHasMore(Boolean(json.hasMore))
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Appends the next page — triggered by the sentinel scrolling into view.
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(records.length) })
      if (search.trim()) params.set("search", search.trim())
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load more records")
      setRecords((prev) => [...prev, ...shapeRecords(json.records ?? [])])
      setHasMore(Boolean(json.hasMore))
    } catch {
      // A failed "load more" isn't worth a page-level error — what's already
      // shown stays usable; the user can just retry by scrolling again.
    } finally {
      setLoadingMore(false)
    }
  }, [records.length, search, dateFrom, dateTo])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      load()
      return
    }
    const t = setTimeout(() => {
      load(search, dateFrom, dateTo)
    }, 300)
    return () => clearTimeout(t)
  }, [search, dateFrom, dateTo, load])

  // Lazy-loads the next page as the sentinel at the bottom of the list
  // scrolls into view — no "Load More" click needed.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) loadMore()
      },
      { rootMargin: "200px" },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadMore])

  // Live updates when a record is created from an inquiry or edited elsewhere.
  // Re-runs with the active search term so the visible filter is preserved.
  // Also refetch on job_order changes — a vehicle's lock (see below) appears
  // the moment a new job is created against it and clears the moment that
  // job is Released/Cancelled, without a manual refresh.
  useRealtimeRefetch(["customer_record", "job_order"], () => load(search, dateFrom, dateTo))

  const groups = useMemo(
    () => groupByCustomer(records, (r) => r.id, (r) => r.contactNumber, (r) => r.psid),
    [records],
  )

  function startEdit(record: CustomerRecord) {
    if (record.activeJobOrderCode) return // defense in depth — the button is already disabled
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

  function validateDraft(): string | null {
    if (!editDraft.plateNumber?.trim()) return "Plate number is required."
    if (!editDraft.vehicleUnit?.trim()) return "Vehicle unit is required."
    if (!editDraft.contactNumber?.trim()) return "Contact number is required."
    const email = editDraft.email?.trim()
    if (email && !EMAIL_PATTERN.test(email)) return "Enter a valid email address."
    return null
  }

  async function saveEdit(id: string) {
    const validationErr = validateDraft()
    if (validationErr) {
      setSaveErr(validationErr)
      return
    }
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

  function applyDateFilter() {
    const err = dateRangeError(pendingFrom, pendingTo)
    setDateErr(err)
    if (err) return
    setDateFrom(pendingFrom)
    setDateTo(pendingTo)
  }

  function resetDateFilter() {
    setPendingFrom(""); setPendingTo("")
    setDateFrom(""); setDateTo("")
    setDateErr(null)
  }

  const rangeLabel = dateRangeLabel(dateFrom, dateTo, fmtDate)
  const filterNote = [search.trim() && `Search “${search.trim()}”`, rangeLabel && `Date added ${rangeLabel}`]
    .filter(Boolean)
    .join(" · ")

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sales/customer-records/${deleteTarget.id}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete")
      const removedId = deleteTarget.id
      setRecords((prev) => prev.filter((r) => r.id !== removedId))
      setDeleteTarget(null)
      toast.success("Customer record deleted.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // The screen only holds one lazily-loaded page, so an export re-reads every
  // match for the current search — paging the same GET the list uses.
  async function fetchAllMatching(): Promise<CustomerRecord[]> {
    const all: CustomerRecord[] = []
    const q = search.trim()
    for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
      const params = new URLSearchParams({ limit: String(EXPORT_PAGE_SIZE), offset: String(offset) })
      if (q) params.set("search", q)
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records for export")
      all.push(...shapeRecords(json.records ?? []))
      if (!json.hasMore) return all
    }
  }

  async function runExport(type: "pdf" | "excel") {
    setExporting(true)
    try {
      const all = await fetchAllMatching()
      if (all.length === 0) {
        toast.error("Nothing to export.")
        return
      }
      const now = new Date()
      if (type === "excel") {
        downloadCsv(exportFilename(now), buildCsv([...EXPORT_HEADERS], all.map(toCsvCells)))
      } else {
        openPrintPreview(buildPrintHtml(all, fmtDate(now.toISOString()), filterNote || null))
      }
      setExportConfirm(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
      setExportConfirm(null)
    } finally {
      setExporting(false)
    }
  }

  const editCell = "h-8 text-sm"

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Customer Records" subtitle="Confirmed customer details from booking inquiries." />

      <Card className="flex flex-wrap items-end gap-4 p-5">
        <div>
          <FieldLabel>Added on or after</FieldLabel>
          <input
            aria-label="Date added on or after"
            type="date"
            value={pendingFrom}
            max={pendingTo || undefined}
            onChange={(e) => setPendingFrom(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <FieldLabel>Added on or before</FieldLabel>
          <input
            aria-label="Date added on or before"
            type="date"
            value={pendingTo}
            min={pendingFrom || undefined}
            onChange={(e) => setPendingTo(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={applyDateFilter}>Apply Filters</Button>
          <Button variant="ghost" onClick={resetDateFilter}>Reset</Button>
        </div>
        {dateErr ? (
          <p className="basis-full text-xs text-status-delayed">{dateErr}</p>
        ) : (
          <p className="basis-full text-xs text-muted">
            {rangeLabel
              ? `Showing records — date added: ${rangeLabel}`
              : "Filter by the date a record was added — leave one side empty for no limit."}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, plate, or contact…"
          containerClassName="max-w-sm flex-1"
        />
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setExportConfirm("pdf")}
            disabled={loading || records.length === 0}
            {...lockProps}
          >
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => setExportConfirm("excel")}
            disabled={loading || records.length === 0}
            {...lockProps}
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {loading ? (
        <CustomerRecordsListSkeleton />
      ) : fetchErr ? (
        <p className="text-sm text-status-delayed">{fetchErr}</p>
      ) : groups.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
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
                    const isLocked = Boolean(record.activeJobOrderCode)
                    return (
                      <div
                        key={record.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3",
                          isLocked && "border-l-2 border-status-warning bg-status-warning/5",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Car className="h-3.5 w-3.5 shrink-0 text-muted" />
                          {isEditing ? (
                            <Input
                              aria-label="Plate number"
                              maxLength={50}
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
                              maxLength={255}
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
                              type="tel"
                              maxLength={20}
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
                              maxLength={255}
                              className={cn(editCell, "w-44")}
                              value={editDraft.email ?? ""}
                              onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                            />
                          ) : (
                            <span className="text-sm text-body">{record.email ?? <span className="text-muted">—</span>}</span>
                          )}
                        </div>

                        <span className="text-xs text-muted">{record.createdAt}</span>

                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
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
                              {/* basis-full forces this onto its own line below the
                                  buttons instead of cramming next to them on one row
                                  (and potentially overflowing the row) when there's
                                  a message to show. */}
                              {saveErr && (
                                <p className="basis-full text-right text-[11px] text-status-delayed">{saveErr}</p>
                              )}
                            </>
                          ) : (
                            <>
                              {isLocked && (
                                <span
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-status-warning/15 px-2.5 py-1 text-[11px] font-semibold text-status-warning"
                                  title={lockedEditMessage(record.activeJobOrderCode as string)}
                                >
                                  <Lock className="h-3 w-3" />
                                  In Service
                                  <span className="font-mono font-medium opacity-80">· {record.activeJobOrderCode}</span>
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => startEdit(record)}
                                disabled={isLocked}
                                title={isLocked ? lockedEditMessage(record.activeJobOrderCode as string) : undefined}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => setDeleteTarget(record)}
                                disabled={isLocked || !isOnline}
                                title={
                                  isLocked
                                    ? deleteBlockedMessage(record.activeJobOrderCode as string)
                                    : !isOnline
                                      ? lockProps.title
                                      : undefined
                                }
                                className="text-status-delayed"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </Button>
                            </>
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
      )}

      {/* Lazy-load sentinel — scrolling this into view fetches the next page. */}
      {hasMore && (
        <div ref={sentinelRef} className="py-2 text-center text-xs text-muted">
          {loadingMore ? "Loading more…" : ""}
        </div>
      )}

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete customer record?"
        message={deleteTarget ? deleteConfirmMessage(deleteTarget) : undefined}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        icon={Trash2}
      />

      <ConfirmModal
        open={exportConfirm !== null}
        onClose={() => setExportConfirm(null)}
        onConfirm={() => { if (exportConfirm) runExport(exportConfirm) }}
        title={exportConfirm === "excel" ? "Export as Excel" : "Export as PDF"}
        message={
          (filterNote ? `Export every customer record matching ${filterNote}` : "Export all customer records") +
          (exportConfirm === "excel" ? " to a CSV file that opens in Excel?" : "? This opens a print preview in a new tab.")
        }
        confirmLabel="Export"
        loading={exporting}
        icon={exportConfirm === "excel" ? FileSpreadsheet : FileText}
      />

      <LinkAccountModal
        open={linkTargetId !== null}
        onClose={() => setLinkTargetId(null)}
        initialRecordId={linkTargetId ?? undefined}
        initialRecord={(() => {
          const r = records.find((rec) => rec.id === linkTargetId)
          return r
            ? {
                id: r.id,
                full_name: r.fullName,
                plate_number: r.plateNumber,
                vehicle_unit: r.vehicleUnit,
                contact_number: r.contactNumber,
                psid: r.psid,
              }
            : undefined
        })()}
        onLinked={(id, psid) =>
          setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, psid } : r)))
        }
      />
    </div>
  )
}
