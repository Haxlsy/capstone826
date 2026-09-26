"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Car, Phone, Mail, Pencil, X, Check, ChevronDown, ChevronUp, Lock, Trash2, FileText, FileSpreadsheet } from "lucide-react"
import { getInitials } from "@/hooks/useCurrentUser"
import { fmtDate } from "@/lib/time-display"
import { dateRangeError, dateRangeLabel } from "@/lib/sales/customer-records-filter"
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
import { LinkAccountModal, type CustomerOption } from "./LinkAccountModal"
import {
  nameLockedMessage,
  vehicleLockedMessage,
  deleteVehicleBlockedMessage,
  deleteCustomerBlockedMessage,
  deleteVehicleConfirmMessage,
  deleteCustomerConfirmMessage,
} from "@/lib/sales/customer-record-lock"
import { buildCsv, downloadCsv, openPrintPreview } from "@/lib/export/print"
import {
  EXPORT_HEADERS,
  toCsvCells,
  exportFilename,
  buildPrintHtml,
  type ExportableCustomerRecord,
} from "@/lib/sales/customer-records-export"
import { CustomerRecordsListSkeleton } from "@/app/dashboard/sales/customer-records/loading"

type MessengerVia = "own" | "booked_by" | null

interface Vehicle {
  id: string
  plateNumber: string
  vehicleUnit: string
  createdAt: string
  /** Name of the customer whose Messenger account booked this vehicle for someone else. */
  bookedByName: string | null
  /** job_order_code of the active job order this vehicle is linked to, if any. */
  activeJobOrderCode: string | null
  /** How job updates reach this vehicle on Messenger; null = they don't. */
  messengerVia: MessengerVia
}

interface Customer {
  id: string
  fullName: string
  contactNumber: string
  email: string | null
  psid: string | null
  createdAt: string
  vehicles: Vehicle[]
}

const PAGE_SIZE = 20
// The API caps a page at 100; exports page through it at that size.
const EXPORT_PAGE_SIZE = 100

function messengerChip(via: MessengerVia): { label: string; title: string; className: string } {
  if (via === "own") {
    return {
      label: "Messenger linked",
      title: "Job updates for this vehicle are sent to the customer's Messenger.",
      className: "bg-status-inspection/10 text-status-inspection",
    }
  }
  if (via === "booked_by") {
    return {
      label: "Updates go to booker's Messenger",
      title: "This vehicle was booked for someone else — job updates go to the Messenger account that booked it.",
      className: "bg-primary/10 text-primary",
    }
  }
  return {
    label: "No Messenger — no updates",
    title: "No Messenger account is linked to this customer — job updates won't be sent. Use Link Messenger Account.",
    className: "bg-surface-muted text-muted",
  }
}

export default function CustomerRecords() {
  const toast = useToast()
  const { isOnline, lockProps } = useOfflineLock()
  const [customers, setCustomers] = useState<Customer[]>([])
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

  // Customer-level edit (name / phone / email) and vehicle-level edit (plate / unit).
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [customerDraft, setCustomerDraft] = useState({ fullName: "", contactNumber: "", email: "" })
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [vehicleDraft, setVehicleDraft] = useState({ plateNumber: "", vehicleUnit: "" })
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const [linkTarget, setLinkTarget] = useState<CustomerOption | null>(null)

  const [deleteVehicle, setDeleteVehicle] = useState<{ customer: Customer; vehicle: Vehicle } | null>(null)
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [exportConfirm, setExportConfirm] = useState<"pdf" | "excel" | null>(null)
  const [exporting, setExporting] = useState(false)

  function shapeCustomers(raw: Record<string, any>[]): Customer[] { // eslint-disable-line @typescript-eslint/no-explicit-any
    return raw.map((c) => ({
      id: c.id,
      fullName: c.full_name,
      contactNumber: c.contact_number ?? "",
      email: c.email ?? null,
      psid: c.psid ?? null,
      createdAt: fmtDate(c.created_at),
      vehicles: (c.vehicles ?? []).map((v: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: v.id,
        plateNumber: v.plate_number,
        vehicleUnit: v.vehicle_unit,
        createdAt: fmtDate(v.created_at),
        bookedByName: v.booked_by_name ?? null,
        activeJobOrderCode: v.active_job_order_code ?? null,
        messengerVia: v.messenger_via ?? null,
      })),
    }))
  }

  const buildParams = useCallback((q: string, from: string, to: string, base: Record<string, string>) => {
    const params = new URLSearchParams(base)
    if (q) params.set("search", q)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    return params
  }, [])

  // Fetches the first page for a (possibly new) search / date range, replacing
  // whatever's currently shown — the lazy-loaded pages beyond it are handled
  // by loadMore() below.
  const load = useCallback(async (q = "", from = "", to = "") => {
    setLoading(true)
    setFetchErr(null)
    try {
      const params = buildParams(q, from, to, { limit: String(PAGE_SIZE) })
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")
      setCustomers(shapeCustomers(json.customers ?? []))
      setHasMore(Boolean(json.hasMore))
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  // Appends the next page — triggered by the sentinel scrolling into view.
  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const params = buildParams(search.trim(), dateFrom, dateTo, {
        limit: String(PAGE_SIZE),
        offset: String(customers.length),
      })
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load more records")
      setCustomers((prev) => [...prev, ...shapeCustomers(json.customers ?? [])])
      setHasMore(Boolean(json.hasMore))
    } catch {
      // A failed "load more" isn't worth a page-level error — what's already
      // shown stays usable; the user can just retry by scrolling again.
    } finally {
      setLoadingMore(false)
    }
  }, [customers.length, search, dateFrom, dateTo, buildParams])

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

  // Live updates when a customer is created/edited elsewhere, and when a job
  // order starts or finishes (a vehicle's "In Service" lock appears the moment
  // a job is created against it and clears when it's Released/Cancelled).
  useRealtimeRefetch(["customer", "customer_record", "job_order"], () => load(search, dateFrom, dateTo))

  // ── Customer edit ────────────────────────────────────────────────────────
  const customerInService = (c: Customer) => c.vehicles.find((v) => v.activeJobOrderCode)?.activeJobOrderCode ?? null

  function startEditCustomer(c: Customer) {
    setEditingVehicleId(null)
    setEditingCustomerId(c.id)
    setCustomerDraft({ fullName: c.fullName, contactNumber: c.contactNumber, email: c.email ?? "" })
    setSaveErr(null)
  }

  function cancelEdit() {
    setEditingCustomerId(null)
    setEditingVehicleId(null)
    setSaveErr(null)
  }

  async function saveCustomer(c: Customer) {
    if (!customerDraft.fullName.trim()) return setSaveErr("Customer name is required.")
    if (!customerDraft.contactNumber.trim()) return setSaveErr("Contact number is required.")
    const email = customerDraft.email.trim()
    if (email && !EMAIL_PATTERN.test(email)) return setSaveErr("Enter a valid email address.")

    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/sales/customers/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: customerDraft.fullName.trim(),
          contact_number: customerDraft.contactNumber.trim(),
          email: email || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save")
      setCustomers((prev) =>
        prev.map((x) =>
          x.id === c.id
            ? { ...x, fullName: customerDraft.fullName.trim(), contactNumber: customerDraft.contactNumber.trim(), email: email || null }
            : x,
        ),
      )
      setEditingCustomerId(null)
      toast.success("Customer updated.")
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Vehicle edit ─────────────────────────────────────────────────────────
  function startEditVehicle(v: Vehicle) {
    if (v.activeJobOrderCode) return // defense in depth — the button is already disabled
    setEditingCustomerId(null)
    setEditingVehicleId(v.id)
    setVehicleDraft({ plateNumber: v.plateNumber, vehicleUnit: v.vehicleUnit })
    setSaveErr(null)
  }

  async function saveVehicle(customerId: string, v: Vehicle) {
    if (!vehicleDraft.plateNumber.trim()) return setSaveErr("Plate number is required.")
    if (!vehicleDraft.vehicleUnit.trim()) return setSaveErr("Vehicle unit is required.")
    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/sales/customer-records/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate_number: vehicleDraft.plateNumber.trim(),
          vehicle_unit: vehicleDraft.vehicleUnit.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save")
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerId
            ? {
                ...c,
                vehicles: c.vehicles.map((x) =>
                  x.id === v.id
                    ? { ...x, plateNumber: vehicleDraft.plateNumber.trim(), vehicleUnit: vehicleDraft.vehicleUnit.trim() }
                    : x,
                ),
              }
            : c,
        ),
      )
      setEditingVehicleId(null)
      toast.success("Vehicle updated.")
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function confirmDelete() {
    setDeleting(true)
    try {
      if (deleteVehicle) {
        const res = await fetch(`/api/sales/customer-records/${deleteVehicle.vehicle.id}`, { method: "DELETE" })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? "Failed to delete")
        const { customer, vehicle } = deleteVehicle
        setCustomers((prev) =>
          prev.map((c) => (c.id === customer.id ? { ...c, vehicles: c.vehicles.filter((v) => v.id !== vehicle.id) } : c)),
        )
        toast.success("Vehicle deleted.")
      } else if (deleteCustomer) {
        const res = await fetch(`/api/sales/customers/${deleteCustomer.id}`, { method: "DELETE" })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error ?? "Failed to delete")
        const removedId = deleteCustomer.id
        setCustomers((prev) => prev.filter((c) => c.id !== removedId))
        toast.success("Customer deleted.")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleteVehicle(null)
      setDeleteCustomer(null)
      setDeleting(false)
    }
  }

  // ── Filters / export ─────────────────────────────────────────────────────
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

  // The screen only holds one lazily-loaded page, so an export re-reads every
  // match for the current search — paging the same GET the list uses — and
  // flattens it to one row per vehicle.
  async function fetchAllMatching(): Promise<ExportableCustomerRecord[]> {
    const all: Customer[] = []
    const q = search.trim()
    for (let offset = 0; ; offset += EXPORT_PAGE_SIZE) {
      const params = buildParams(q, dateFrom, dateTo, { limit: String(EXPORT_PAGE_SIZE), offset: String(offset) })
      const res = await fetch(`/api/sales/customer-records?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records for export")
      all.push(...shapeCustomers(json.customers ?? []))
      if (!json.hasMore) break
    }
    return all.flatMap((c) =>
      c.vehicles.map((v) => ({
        fullName: c.fullName,
        contactNumber: c.contactNumber,
        email: c.email,
        plateNumber: v.plateNumber,
        vehicleUnit: v.vehicleUnit,
        messengerLinked: v.messengerVia !== null,
        createdAt: v.createdAt,
        activeJobOrderCode: v.activeJobOrderCode,
      })),
    )
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
      <PageHeader title="Customer Records" subtitle="Confirmed customers and their vehicles from booking inquiries." />

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
              ? `Showing customers — date added: ${rangeLabel}`
              : "Filter by the date a customer was added — leave one side empty for no limit."}
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
            disabled={loading || customers.length === 0}
            {...lockProps}
          >
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => setExportConfirm("excel")}
            disabled={loading || customers.length === 0}
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
      ) : customers.length === 0 ? (
        <EmptyState title="No records found." />
      ) : (
      <div className="flex flex-col gap-3">
        {customers.map((customer) => {
          const isMulti = customer.vehicles.length > 1
          const isExpanded = !isMulti || Boolean(expanded[customer.id])
          const inServiceCode = customerInService(customer)
          const isEditingCustomer = editingCustomerId === customer.id

          return (
            <div key={customer.id} className="bg-surface border border-border rounded-card overflow-hidden">
              {/* Customer header */}
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 px-5 py-3.5",
                  isMulti && "cursor-pointer hover:bg-surface-muted/50 transition-colors",
                )}
                onClick={isMulti ? () => setExpanded((p) => ({ ...p, [customer.id]: !p[customer.id] })) : undefined}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-body">
                  {getInitials(customer.fullName)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-heading">{customer.fullName}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLinkTarget({
                        id: customer.id,
                        full_name: customer.fullName,
                        contact_number: customer.contactNumber,
                        psid: customer.psid,
                        plates: customer.vehicles.map((v) => v.plateNumber),
                      })
                    }}
                    className={cn(
                      customer.psid
                        ? "font-mono text-[11px] text-muted hover:text-primary hover:underline"
                        : "text-[11px] font-semibold text-primary hover:underline",
                    )}
                    title={customer.psid ? "Click to relink" : undefined}
                  >
                    {customer.psid ?? "Link Messenger Account"}
                  </button>
                </div>
                <span className="text-xs text-muted shrink-0">
                  {customer.vehicles.length} {customer.vehicles.length === 1 ? "vehicle" : "vehicles"}
                </span>
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="subtle" onClick={() => startEditCustomer(customer)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="subtle"
                    className="text-status-delayed"
                    onClick={() => setDeleteCustomer(customer)}
                    disabled={Boolean(inServiceCode) || !isOnline}
                    title={
                      inServiceCode
                        ? deleteCustomerBlockedMessage(inServiceCode)
                        : !isOnline
                          ? lockProps.title
                          : undefined
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
                {isMulti && (isExpanded ? <ChevronUp className="h-4 w-4 text-muted shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted shrink-0" />)}
              </div>

              {/* Customer contact line / edit panel */}
              <div className="border-t border-border-subtle px-5 py-3">
                {isEditingCustomer ? (
                  <div className="flex flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <FieldLabel>Name</FieldLabel>
                        <Input
                          aria-label="Customer name"
                          maxLength={255}
                          className={editCell}
                          value={customerDraft.fullName}
                          disabled={Boolean(inServiceCode)}
                          title={inServiceCode ? nameLockedMessage(inServiceCode) : undefined}
                          onChange={(e) => setCustomerDraft((d) => ({ ...d, fullName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <FieldLabel>Contact number</FieldLabel>
                        <Input
                          aria-label="Contact number"
                          type="tel"
                          maxLength={20}
                          className={editCell}
                          value={customerDraft.contactNumber}
                          onChange={(e) => setCustomerDraft((d) => ({ ...d, contactNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <FieldLabel>Email</FieldLabel>
                        <Input
                          aria-label="Email"
                          type="email"
                          maxLength={255}
                          className={editCell}
                          value={customerDraft.email}
                          onChange={(e) => setCustomerDraft((d) => ({ ...d, email: e.target.value }))}
                        />
                      </div>
                    </div>
                    {inServiceCode && (
                      <p className="text-[11px] text-status-warning">{nameLockedMessage(inServiceCode)} Phone and email can still be changed.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => saveCustomer(customer)} disabled={saving}>
                        <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button size="sm" variant="subtle" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                      {saveErr && <p className="text-[11px] text-status-delayed">{saveErr}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-body">
                    <span className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted" />{customer.contactNumber || "—"}</span>
                    <span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted" />{customer.email ?? <span className="text-muted">—</span>}</span>
                    <span className="text-xs text-muted">Added {customer.createdAt}</span>
                  </div>
                )}
              </div>

              {/* Vehicles — each plate + vehicle unit, independently editable */}
              {isExpanded && (
                <div className="divide-y divide-border-subtle border-t border-border-subtle">
                  {customer.vehicles.length === 0 && (
                    <p className="px-5 py-3 text-xs text-muted">No vehicles on file.</p>
                  )}
                  {customer.vehicles.map((v) => {
                    const isEditing = editingVehicleId === v.id
                    const isLocked = Boolean(v.activeJobOrderCode)
                    const chip = messengerChip(v.messengerVia)
                    return (
                      <div
                        key={v.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3",
                          isLocked && "border-l-2 border-status-warning bg-status-warning/5",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-[220px]">
                          <Car className="h-3.5 w-3.5 shrink-0 text-muted" />
                          {isEditing ? (
                            <>
                              <Input
                                aria-label="Plate number"
                                maxLength={50}
                                className={cn(editCell, "w-28")}
                                value={vehicleDraft.plateNumber}
                                onChange={(e) => setVehicleDraft((d) => ({ ...d, plateNumber: e.target.value }))}
                              />
                              <Input
                                aria-label="Vehicle unit"
                                maxLength={255}
                                className={cn(editCell, "w-40")}
                                value={vehicleDraft.vehicleUnit}
                                onChange={(e) => setVehicleDraft((d) => ({ ...d, vehicleUnit: e.target.value }))}
                              />
                            </>
                          ) : (
                            <>
                              <span className="font-mono font-medium text-body">{v.plateNumber}</span>
                              <span className="text-body">{v.vehicleUnit}</span>
                            </>
                          )}
                        </div>

                        <span
                          className={cn(
                            "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            chip.className,
                          )}
                          title={chip.title}
                        >
                          {chip.label}
                        </span>
                        {v.bookedByName && (
                          <span className="text-[11px] text-muted">Booked via {v.bookedByName}&apos;s Messenger</span>
                        )}
                        <span className="text-xs text-muted">{v.createdAt}</span>

                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => saveVehicle(customer.id, v)} disabled={saving}>
                                  <Check className="h-3.5 w-3.5" />
                                  {saving ? "Saving…" : "Save"}
                                </Button>
                                <Button size="sm" variant="subtle" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5" /> Cancel
                                </Button>
                              </div>
                              {saveErr && (
                                <p className="basis-full text-right text-[11px] text-status-delayed">{saveErr}</p>
                              )}
                            </>
                          ) : (
                            <>
                              {isLocked && (
                                <span
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-status-warning/15 px-2.5 py-1 text-[11px] font-semibold text-status-warning"
                                  title={vehicleLockedMessage(v.activeJobOrderCode as string)}
                                >
                                  <Lock className="h-3 w-3" />
                                  In Service
                                  <span className="font-mono font-medium opacity-80">· {v.activeJobOrderCode}</span>
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => startEditVehicle(v)}
                                disabled={isLocked}
                                title={isLocked ? vehicleLockedMessage(v.activeJobOrderCode as string) : undefined}
                              >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => setDeleteVehicle({ customer, vehicle: v })}
                                disabled={isLocked || !isOnline}
                                title={
                                  isLocked
                                    ? deleteVehicleBlockedMessage(v.activeJobOrderCode as string)
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
        open={deleteVehicle !== null || deleteCustomer !== null}
        onClose={() => { setDeleteVehicle(null); setDeleteCustomer(null) }}
        onConfirm={confirmDelete}
        title={deleteCustomer ? "Delete customer?" : "Delete vehicle?"}
        message={
          deleteCustomer
            ? deleteCustomerConfirmMessage({
                fullName: deleteCustomer.fullName,
                vehicleCount: deleteCustomer.vehicles.length,
                psid: deleteCustomer.psid,
              })
            : deleteVehicle
              ? deleteVehicleConfirmMessage({
                  plateNumber: deleteVehicle.vehicle.plateNumber,
                  vehicleUnit: deleteVehicle.vehicle.vehicleUnit,
                })
              : undefined
        }
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
        open={linkTarget !== null}
        onClose={() => setLinkTarget(null)}
        initialCustomer={linkTarget ?? undefined}
        onLinked={(id, psid) =>
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, psid, vehicles: c.vehicles.map((v) => ({ ...v, messengerVia: "own" as const })) } : c,
            ),
          )
        }
      />
    </div>
  )
}
