"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { JobManagementSkeleton } from "@/app/dashboard/job-management/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { SearchBar } from "@/components/ui/SearchBar"
import { Popover } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { StatusBadge } from "@/components/ui/Badge"
import { Select, FieldLabel } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import StatusPickerModal, { type JobStatus, type StatusOption } from "./StatusPickerModal"
import StatusConfirmDialog from "./StatusConfirmDialog"
import { fmtDate } from "@/lib/time-display"

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
}

type TabType = "All" | "Pending" | "Ongoing" | "For Rework" | "For Inspection" | "For Release" | "Delayed"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "For Rework", "For Inspection", "For Release", "Delayed"]

export default function JobManagementTable() {
  const router = useRouter()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([])
  const [loading, setLoading] = useState(true)
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

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")

      const mapped: JobOrder[] = (json.job_orders ?? []).map((r: any) => ({
        id: r.id,
        displayId: `JO-${new Date(r.created_at).getFullYear()}-${r.id.slice(-4).toUpperCase()}`,
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
      }))

      setJobOrders(mapped)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [load])

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
      jobOrders.filter((job) => {
        const isDelayed =
          job.status === "Delayed" ||
          (job.is_overdue && (job.status === "Pending" || job.status === "Ongoing"))
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
    [jobOrders, activeTab, searchQuery, filterService, filterTechnician, filterDateFrom, filterDateTo],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  function closeAll() {
    setPickerJob(null)
    setConfirmTarget(null)
    setUpdateError(null)
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
      cell: (job) => (
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
      cell: (job) => {
        const display =
          job.is_overdue && (job.status === "Pending" || job.status === "Ongoing")
            ? "Delayed"
            : job.status
        return <StatusBadge status={display} />
      },
    },
    {
      key: "go",
      header: "",
      align: "right",
      cell: () => <span className="whitespace-nowrap text-[11px] font-medium text-muted">View details →</span>,
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
          onRowClick={(job) => router.push(`/dashboard/job-management/${job.id}`)}
          error={fetchError}
          emptyLabel="No job orders found."
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
