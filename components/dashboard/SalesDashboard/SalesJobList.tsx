"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { ArrowRight } from "lucide-react"
import { fmtDate } from "@/lib/time-display"
import { displayJobStatus } from "@/lib/job-delay"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Popover } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, RowActionHint, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { StatusBadge } from "@/components/ui/Badge"
import { FieldLabel } from "@/components/ui/Field"
import type { JobOrdersData } from "@/lib/operations/job-orders-data"

type RawJobOrder = JobOrdersData["job_orders"][number]

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
  status: string
}

type TabType = "All" | "Pending" | "Ongoing" | "For Rework" | "For Release" | "Delayed" | "Cancelled"
const TABS: TabType[] = ["All", "Pending", "Ongoing", "For Rework", "For Release", "Delayed", "Cancelled"]

const PAGE_SIZE = 15

export default function SalesJobList({ jobOrders: initialJobOrders }: { jobOrders: RawJobOrder[] }) {
  const router = useRouter()

  // Self-managed + realtime-refetched, same endpoint Operations' Job
  // Management uses (read-only here — no write actions) — a light client
  // refetch instead of router.refresh() re-running the whole server fetch
  // on every change event.
  const [rawOrders, setRawOrders] = useState<RawJobOrder[]>(initialJobOrders)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/job-management/list-job-orders")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to fetch job orders")
      setRawOrders(json.job_orders ?? [])
    } catch {
      // Silent — this is a background revalidation; the last-known list stays shown.
    }
  }, [])

  useEffect(() => { load() }, [load])
  useRealtimeRefetch(["job_order", "job_stage_progress"], load)

  const jobOrders = useMemo(
    () =>
      rawOrders.map((r): JobOrder => ({
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
        // Resolved once here — tabs/counts/badge all read this one field, so
        // they never need their own separate "is it actually delayed" check.
        status: displayJobStatus(r.status ?? "Pending", Boolean(r.is_overdue)),
      })),
    [rawOrders],
  )

  const [activeTab, setActiveTab] = useState<TabType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const [filterService, setFilterService] = useState("")
  const [filterTechnician, setFilterTechnician] = useState("")
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")

  const activeFilters = [filterService, filterTechnician, filterDateFrom, filterDateTo].filter(Boolean)
  const hasActiveFilter = activeFilters.length > 0

  const filtered = jobOrders.filter((j) => {
    if (activeTab !== "All" && j.status !== activeTab) return false
    const q = searchQuery.toLowerCase()
    if (
      q &&
      !`${j.customer} ${j.displayId} ${j.plate} ${j.vehicle} ${j.service} ${j.headDetailer} ${j.headInstaller}`
        .toLowerCase()
        .includes(q)
    )
      return false
    if (filterService && !j.service.toLowerCase().includes(filterService.toLowerCase())) return false
    if (
      filterTechnician &&
      ![j.headDetailer, j.headInstaller].join(" ").toLowerCase().includes(filterTechnician.toLowerCase())
    )
      return false
    if (filterDateFrom && j.scheduledRaw && j.scheduledRaw < filterDateFrom) return false
    if (filterDateTo && j.scheduledRaw && j.scheduledRaw > filterDateTo + "T23:59:59") return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabCounts: Record<string, number> = { All: jobOrders.length }
  for (const j of jobOrders) tabCounts[j.status] = (tabCounts[j.status] ?? 0) + 1

  const columns: Column<JobOrder>[] = [
    { key: "id", header: "Job ID", cell: (j) => <span className="font-mono text-xs font-semibold text-body">{j.displayId}</span> },
    { key: "customer", header: "Customer", cell: (j) => <span className="font-medium text-heading">{j.customer}</span> },
    { key: "plate", header: "Plate", cell: (j) => <span className="text-body">{j.plate}</span> },
    { key: "vehicle", header: "Vehicle", cell: (j) => <span className="block max-w-28 truncate text-body">{j.vehicle}</span> },
    { key: "service", header: "Service", cell: (j) => <span className="block max-w-36 truncate text-body">{j.service}</span> },
    { key: "hd", header: "Head Detailer", cell: (j) => <span className="text-xs text-body">{j.headDetailer}</span> },
    { key: "hi", header: "Head Installer", cell: (j) => <span className="text-xs text-body">{j.headInstaller}</span> },
    { key: "sched", header: "Scheduled", cell: (j) => <span className="whitespace-nowrap text-xs text-muted">{j.scheduled}</span> },
    { key: "status", header: "Status", cell: (j) => <StatusBadge status={j.status} /> },
    {
      key: "go",
      header: "",
      align: "right",
      cell: () => <RowActionHint icon={ArrowRight} />,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="View Job Orders" subtitle="Read-only reference view of all active job orders." />

      <Tabs
        items={TABS.map((t) => ({ key: t, label: t, count: tabCounts[t] || undefined }))}
        value={activeTab}
        onChange={(k) => {
          setActiveTab(k as TabType)
          setCurrentPage(1)
        }}
      />

      <div className="flex flex-wrap items-start gap-3">
        <SearchBar
          value={searchQuery}
          onChange={(v) => {
            setSearchQuery(v)
            setCurrentPage(1)
          }}
          placeholder="Search customer, job ID, plate, service…"
          containerClassName="max-w-sm flex-1"
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
              <input
                type="text"
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                placeholder="e.g. Ceramic Coating"
                className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <FieldLabel>Technician</FieldLabel>
              <input
                type="text"
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                placeholder="Name"
                className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <FieldLabel>Scheduled From</FieldLabel>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <FieldLabel>Scheduled To</FieldLabel>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {hasActiveFilter && (
              <button
                onClick={() => {
                  setFilterService("")
                  setFilterTechnician("")
                  setFilterDateFrom("")
                  setFilterDateTo("")
                }}
                className="text-left text-xs text-muted transition-colors hover:text-status-delayed sm:col-span-2"
              >
                Clear all filters
              </button>
            )}
          </div>
        </Popover>
      </div>

      <DataTable
        columns={columns}
        rows={paginated}
        rowKey={(j) => j.id}
        onRowClick={(j) => router.push(`/dashboard/sales/jobs/${j.id}`)}
        emptyLabel="No job orders found."
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalLabel={`Showing ${paginated.length} of ${filtered.length} jobs`}
          />
        }
      />
    </div>
  )
}
