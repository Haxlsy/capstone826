"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, ArrowRight, CloudOff, WifiOff } from "lucide-react"
import { JobManagementSkeleton } from "@/app/dashboard/job-management/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { SearchBar } from "@/components/ui/SearchBar"
import { Popover } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, RowActionHint, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { StatusBadge, Badge } from "@/components/ui/Badge"
import { Select, FieldLabel } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { useOfflineSyncContext } from "@/components/dashboard/OperationComponents/OfflineSyncContext"
import StatusPickerModal, { type JobStatus, type StatusOption } from "./StatusPickerModal"
import StatusConfirmDialog from "./StatusConfirmDialog"
import { fmtDate } from "@/lib/time-display"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { displayJobStatus } from "@/lib/job-delay"
import { remove as removeQueued } from "@/lib/offline/outbox"
import type { JobOrdersData } from "@/lib/operations/job-orders-data"
import type { OutboxItem } from "@/lib/offline/db"

interface JobOrder {
  id: string
  displayId: string
  customer: string
  plate: string
  vehicle: string
  service: string
  headDetailer: string
  headInstaller: string
  scheduled: string
  scheduledRaw: string
  status: JobStatus
  is_overdue: boolean
  /** Rows that only exist in the offline outbox (not yet synced to the server). */
  isQueued?: boolean
  queueStatus?: OutboxItem["status"]
}

type RawJobOrder = JobOrdersData["job_orders"][number]

function mapJobOrder(r: RawJobOrder): JobOrder {
  return {
    id: r.id,
    displayId: r.job_order_code,
    customer: r.customer_name ?? "—",
    plate: r.plate_number ?? "—",
    vehicle: r.vehicle_unit ?? "—",
    service: r.service ?? "—",
    headDetailer: r.head_detailer ?? "Unassigned",
    headInstaller: r.head_installer ?? "Unassigned",
    scheduled: fmtDate(r.scheduled_at),
    scheduledRaw: r.scheduled_at ?? "",
    status: (r.status as JobStatus) ?? "Pending",
    is_overdue: r.is_overdue ?? false,
  }
}

// An offline-queued Add Job Order → a table row, from the UI-only `_display`
// snapshot captured at queue time (AddJobOrderForm). No real job_order_code
// or detail page exists yet.
function mapQueuedRow(item: OutboxItem): JobOrder {
  const d = ((item.payload as { _display?: Record<string, string> })._display) ?? {}
  return {
    id: item.id,
    displayId: "—",
    customer: d.customer_name || "New customer",
    plate: d.plate_number || "—",
    vehicle: d.vehicle_unit || "—",
    service: d.service || "—",
    headDetailer: d.head_detailer || "Unassigned",
    headInstaller: d.head_installer || "Unassigned",
    scheduled: d.scheduled_at ? fmtDate(d.scheduled_at) : "—",
    scheduledRaw: d.scheduled_at || "",
    status: "Pending",
    is_overdue: false,
    isQueued: true,
    queueStatus: item.status,
  }
}

type TabType = "All" | "Pending" | "Ongoing" | "For Rework" | "For Inspection" | "For Release" | "Delayed"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]

export default function JobManagementTable({ initialJobOrders }: { initialJobOrders?: RawJobOrder[] }) {
  const router = useRouter()
  const toast = useToast()
  const { isOnline, queuedItems } = useOfflineSyncContext()
  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [jobOrders, setJobOrders] = useState<JobOrder[]>(() => (initialJobOrders ?? []).map(mapJobOrder))
  // initialJobOrders means there's already something to show — skip the
  // skeleton and silently revalidate in the background instead (below).
  const [loading, setLoading] = useState(!initialJobOrders)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [pickerJob, setPickerJob] = useState<JobOrder | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<StatusOption | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const [filterService, setFilterService] = useState("")
  const [filterTechnician, setFilterTechnician] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  const activeFilters = [filterService, filterTechnician, filterDateFrom, filterDateTo].filter(Boolean)
  const hasActiveFilter = activeFilters.length > 0

  function clearFilters() {
    setFilterService("")
    setFilterTechnician("")
    setFilterDateFrom("")
    setFilterDateTo("")
  }

  // Mirror the hook's online state into a ref so `load` (a stable useCallback)
  // can read it. Chrome DevTools "Network: Offline" leaves navigator.onLine
  // === true, so we can't trust navigator.onLine here.
  const isOnlineRef = useRef(isOnline)
  useEffect(() => {
    isOnlineRef.current = isOnline
  }, [isOnline])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

      const mapped: JobOrder[] = (json.job_orders ?? []).map(mapJobOrder)

      setJobOrders(mapped)
    } catch (err: unknown) {
      // A rejected fetch (network error → TypeError) or being offline means we
      // couldn't reach the server at all — keep the last-known + queued rows
      // instead of blanking them. Only a real HTTP error (our own thrown Error)
      // surfaces as "Failed to fetch".
      const cantReachServer = err instanceof TypeError || !isOnlineRef.current
      if (cantReachServer) {
        setFetchError(null)
      } else {
        setFetchError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Already have initialJobOrders from the server — revalidate silently
    // in the background instead of flashing the skeleton again.
    load({ silent: !!initialJobOrders })
  }, [load, initialJobOrders])

  // Refetch the authoritative list once the connection comes back, so queued
  // rows get replaced by the real job orders.
  const prevOnline = useRef(isOnline)
  useEffect(() => {
    if (isOnline && !prevOnline.current) load({ silent: true })
    prevOnline.current = isOnline
  }, [isOnline, load])

  useEffect(() => {
    const onFocus = () => load({ silent: true })
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [load])

  // A job-level change (new job, status set without touching a stage, team
  // reassignment) or a technician marking a stage done should both reflect
  // here without waiting for window focus or a manual reload — silent so it
  // doesn't flash the skeleton.
  useRealtimeRefetch(["job_order", "job_stage_progress"], useCallback(() => load({ silent: true }), [load]))

  const queuedRows = useMemo(
    () => queuedItems.filter((i) => i.type === "add_job_order").map(mapQueuedRow),
    [queuedItems],
  )

  // Offline → only what's saved on this device (per the user's ask). Online →
  // the real list plus any queued rows that haven't synced away yet.
  const displayRows = useMemo(
    () => (isOnline ? [...queuedRows, ...jobOrders] : queuedRows),
    [isOnline, queuedRows, jobOrders],
  )

  const uniqueServices = useMemo(
    () => [...new Set(jobOrders.map((j) => j.service).filter((s) => s !== "—"))].sort(),
    [jobOrders],
  )
  const uniqueTechnicians = useMemo(() => {
    const names = jobOrders
      .flatMap((j) => [j.headDetailer, j.headInstaller])
      .filter((t) => t !== "Unassigned")
    return [...new Set(names)].sort()
  }, [jobOrders])

  const filtered = useMemo(
    () =>
      displayRows.filter((job) => {
        const isDelayed = displayJobStatus(job.status, job.is_overdue) === "Delayed"
        const matchesTab =
          activeTab === "All" || (activeTab === "Delayed" ? isDelayed : job.status === activeTab)
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          q === "" ||
          job.customer.toLowerCase().includes(q) ||
          job.displayId.toLowerCase().includes(q) ||
          job.plate.toLowerCase().includes(q) ||
          job.vehicle.toLowerCase().includes(q) ||
          job.service.toLowerCase().includes(q) ||
          job.headDetailer.toLowerCase().includes(q) ||
          job.headInstaller.toLowerCase().includes(q)
        const matchesService = !filterService || job.service === filterService
        const matchesTechnician =
          !filterTechnician ||
          job.headDetailer === filterTechnician ||
          job.headInstaller === filterTechnician
        const jobDate = job.scheduledRaw ? job.scheduledRaw.slice(0, 10) : ""
        const matchesDateFrom = !filterDateFrom || jobDate >= filterDateFrom
        const matchesDateTo = !filterDateTo || jobDate <= filterDateTo
        return (
          matchesTab &&
          matchesSearch &&
          matchesService &&
          matchesTechnician &&
          matchesDateFrom &&
          matchesDateTo
        )
      }),
    [displayRows, activeTab, searchQuery, filterService, filterTechnician, filterDateFrom, filterDateTo],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  function closeAll() {
    setPickerJob(null)
    setConfirmTarget(null)
    setUpdateError(null)
  }

  // Drop a queued Add Job Order that can't sync (bad/stale payload from an
  // earlier session). The outbox broadcasts a change event, so useOfflineSync
  // refreshes and the row disappears.
  async function discardQueued(id: string) {
    try {
      await removeQueued(id)
      toast.info("Removed the queued job order.")
    } catch (err) {
      console.error("[offline] discard queued item failed", err)
      toast.error("Couldn't remove that item.")
    }
  }

  async function confirmUpdate(reason: string) {
    if (!confirmTarget || !pickerJob) return
    setUpdating(true)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${pickerJob.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmTarget.db, reason }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to update status")
      setJobOrders((prev) =>
        prev.map((j) => (j.id === pickerJob.id ? { ...j, status: confirmTarget.label } : j)),
      )
      toast.success(`Status updated to ${confirmTarget.label}.`)
      closeAll()
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : String(err))
    } finally {
      setUpdating(false)
    }
  }

  const columns: Column<JobOrder>[] = [
    {
      key: "id",
      header: "Job Order ID",
      cell: (job) =>
        job.isQueued ? (
          <span className="font-mono text-xs italic text-muted">Not synced</span>
        ) : (
          <Link
            href={`/dashboard/job-management/${job.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-xs text-primary hover:underline"
          >
            {job.displayId}
          </Link>
        ),
    },
    { key: "customer", header: "Customer", cell: (job) => <span className="font-semibold text-heading">{job.customer}</span> },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (job) => (
        <span className="text-xs">
          <span className="text-primary">{job.plate}</span>
          <span className="text-muted"> — {job.vehicle}</span>
        </span>
      ),
    },
    { key: "service", header: "Service", cell: (job) => <span className="text-body">{job.service}</span> },
    {
      key: "hd",
      header: "Head Detailer",
      cell: (job) => (
        <span className={job.headDetailer === "Unassigned" ? "italic text-muted" : "text-body"}>
          {job.headDetailer}
        </span>
      ),
    },
    {
      key: "hi",
      header: "Head Installer",
      cell: (job) => (
        <span className={job.headInstaller === "Unassigned" ? "italic text-muted" : "text-body"}>
          {job.headInstaller}
        </span>
      ),
    },
    { key: "sched", header: "Scheduled Start", cell: (job) => <span className="text-body">{job.scheduled}</span> },
    {
      key: "status",
      header: "Status",
      cell: (job) =>
        job.isQueued ? (
          <Badge className="border border-status-delayed/30 bg-status-delayed/10 text-status-delayed">
            <WifiOff className="h-3 w-3" />
            {job.queueStatus === "failed" ? "Sync failed" : "Pending sync"}
          </Badge>
        ) : (
          <StatusBadge status={displayJobStatus(job.status, job.is_overdue)} />
        ),
    },
    {
      key: "go",
      header: "",
      align: "right",
      cell: (job) =>
        job.isQueued && job.queueStatus === "failed" ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              discardQueued(job.id)
            }}
            className="rounded-sm px-2 py-1 text-xs font-medium text-status-delayed transition-colors hover:bg-status-delayed/10"
          >
            Discard
          </button>
        ) : job.isQueued ? null : (
          <RowActionHint icon={ArrowRight} />
        ),
    },
  ]

  if (loading) return <JobManagementSkeleton />

  return (
    <>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Job Order"
          actions={
            <Button onClick={() => router.push("/dashboard/job-management/add")}>
              <Plus className="h-4 w-4" />
              Add Job Order
            </Button>
          }
        />

        {(queuedRows.length > 0 || !isOnline) && (
          <div className="flex items-center gap-2 rounded-card border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span>
              {queuedRows.length > 0
                ? `${queuedRows.length} job order${queuedRows.length === 1 ? "" : "s"} saved on this device — ${
                    isOnline
                      ? "syncing now…"
                      : "they'll sync automatically when you're back online."
                  }`
                : "You're offline — showing job orders saved on this device. The full list loads when you reconnect."}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by customer, plate, vehicle, service, technician, or Job ID…"
              containerClassName="max-w-xl flex-1"
            />
            <Popover
              align="end"
              trigger={({ open, toggle }) => (
                <FilterTrigger
                  open={open}
                  onClick={toggle}
                  active={hasActiveFilter}
                  count={activeFilters.length}
                />
              )}
              panelClassName="w-[min(90vw,28rem)] p-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Service</FieldLabel>
                  <Select value={filterService} onChange={(e) => setFilterService(e.target.value)}>
                    <option value="">All Services</option>
                    {uniqueServices.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Head Technician</FieldLabel>
                  <Select value={filterTechnician} onChange={(e) => setFilterTechnician(e.target.value)}>
                    <option value="">All Technicians</option>
                    {uniqueTechnicians.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Scheduled From</FieldLabel>
                  <input
                    type="date"
                    aria-label="Scheduled from"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <FieldLabel>Scheduled To</FieldLabel>
                  <input
                    type="date"
                    aria-label="Scheduled to"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                {hasActiveFilter && (
                  <button
                    onClick={clearFilters}
                    className="text-left text-xs text-muted transition-colors hover:text-status-delayed sm:col-span-2"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </Popover>
          </div>
        </div>

        <Tabs
          items={TABS.map((t) => ({ key: t, label: t }))}
          value={activeTab}
          onChange={(k) => {
            setActiveTab(k as TabType)
            setCurrentPage(1)
          }}
        />

        <DataTable
          columns={columns}
          rows={paginated}
          rowKey={(job) => job.id}
          onRowClick={(job) => {
            if (job.isQueued) return
            router.push(`/dashboard/job-management/${job.id}`)
          }}
          error={fetchError}
          emptyLabel={isOnline ? "No job orders found." : "You're offline — no job orders saved on this device yet."}
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setCurrentPage(1)
              }}
              pageSizeOptions={[15, 25, 50]}
            />
          }
        />
      </div>

      {pickerJob && !confirmTarget && (
        <StatusPickerModal
          jobId={pickerJob.displayId}
          customerName={pickerJob.customer}
          currentStatus={pickerJob.status}
          onSelect={(opt) => setConfirmTarget(opt)}
          onClose={closeAll}
        />
      )}

      {confirmTarget && pickerJob && (
        <StatusConfirmDialog
          customerName={pickerJob.customer}
          target={confirmTarget}
          error={updateError}
          updating={updating}
          onConfirm={confirmUpdate}
          onBack={() => setConfirmTarget(null)}
        />
      )}
    </>
  )
}
