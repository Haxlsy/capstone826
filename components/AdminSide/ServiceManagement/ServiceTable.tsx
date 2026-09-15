"use client"

import { useCallback, useEffect, useState } from "react"
import { MoreHorizontal } from "lucide-react"
import AddServiceModal from "./AddServiceModal"
import EditServiceModal from "./EditServiceModal"
import AddServiceTypeModal from "./AddServiceTypeModal"
import CategoryPresetsPanel from "./CategoryPresetsPanel"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Button } from "@/components/ui/Button"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { Popover, MenuItem } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface Service {
  id: string
  name: string
  service_type: string | null
  description: string | null
  estimated_duration_mins: number | null
  is_archived: boolean
  stage_count: number
  job_order_count: number
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

function truncate(text: string | null, max = 48) {
  if (!text) return "—"
  return text.length > max ? text.slice(0, max) + "..." : text
}

function formatDuration(mins: number | null) {
  if (!mins) return "—"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 24) {
    const hrsLabel = hours === 1 ? "1 hr" : `${hours} hrs`
    return rem === 0 ? hrsLabel : `${hrsLabel} ${rem} min`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  const daysLabel = days === 1 ? "1 day" : `${days} days`
  return remHours === 0 ? daysLabel : `${daysLabel} ${remHours} hrs`
}

export default function ServiceTable({ canWrite = true }: { canWrite?: boolean }) {
  const toast = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [totalCount, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active")
  const [durationMin, setDurationMin] = useState("")
  const [durationMax, setDurationMax] = useState("")

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addTypeModalOpen, setAddTypeModalOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [editServiceId, setEditServiceId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, durationMin, durationMax, pageSize])

  const fetchServices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        limit: String(pageSize),
      })
      const minMins = durationMin ? String(Number(durationMin) * 60) : ""
      const maxMins = durationMax ? String(Number(durationMax) * 60) : ""
      if (minMins) params.set("durationMin", minMins)
      if (maxMins) params.set("durationMax", maxMins)
      const res = await fetch(`/api/operations/services?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load services")
      setServices(json.services ?? [])
      setTotal(json.total ?? 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, durationMin, durationMax, page, pageSize])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  // Another admin adding/editing/archiving a service should show up here
  // without a manual reload.
  useRealtimeRefetch("service", fetchServices)

  async function handleArchiveToggle(service: Service) {
    try {
      const res = await fetch(`/api/operations/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: !service.is_archived }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) toast.success(service.is_archived ? "Service restored." : "Service archived.")
      else toast.error(json?.error ?? "Failed to update service.")
      fetchServices()
    } catch {
      toast.error("Failed to update service.")
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasFilter = statusFilter !== "active" || !!durationMin || !!durationMax

  const columns: Column<Service>[] = [
    {
      key: "type",
      header: "Service Type",
      cell: (s) =>
        s.service_type ? (
          <Badge className="whitespace-nowrap bg-status-release/12 text-status-release">{s.service_type}</Badge>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
    { key: "name", header: "Service Name", cell: (s) => <span className="font-medium text-heading">{s.name}</span> },
    { key: "desc", header: "Description", cell: (s) => <span className="block max-w-xs text-muted">{truncate(s.description)}</span> },
    { key: "dur", header: "Est. Duration", cell: (s) => <span className="text-body">{formatDuration(s.estimated_duration_mins)}</span> },
    {
      key: "stages",
      header: "Workflow Stages",
      cell: (s) =>
        s.stage_count > 0 ? (
          <Badge className="bg-surface-muted text-body">
            {s.stage_count} {s.stage_count === 1 ? "stage" : "stages"}
          </Badge>
        ) : (
          <span className="text-xs text-muted">No stages</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={s.is_archived ? "archived" : "active"} />
          {s.job_order_count > 0 && (
            <StatusBadge status="in_use" label={`In Use (${s.job_order_count})`} />
          )}
        </div>
      ),
    },
    ...(canWrite
      ? [
          {
            key: "actions",
            header: "",
            align: "right" as const,
            cell: (s: Service) => (
              <Popover
                align="end"
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    aria-label="Service options"
                    onClick={toggle}
                    className="rounded-sm p-1 text-muted transition-colors hover:bg-surface-muted hover:text-body"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                )}
              >
                {(close) => {
                  const inUse = s.job_order_count > 0
                  const lockedHint = `${s.job_order_count} job order${s.job_order_count === 1 ? "" : "s"} currently using this service must finish first.`
                  return (
                    <>
                      <MenuItem
                        disabled={inUse}
                        title={inUse ? lockedHint : undefined}
                        onClick={() => {
                          close()
                          setEditServiceId(s.id)
                        }}
                      >
                        Edit Service
                      </MenuItem>
                      <MenuItem
                        danger={!s.is_archived}
                        disabled={!s.is_archived && inUse}
                        title={!s.is_archived && inUse ? lockedHint : undefined}
                        onClick={() => {
                          close()
                          handleArchiveToggle(s)
                        }}
                      >
                        {s.is_archived ? "Unarchive" : "Archive"}
                      </MenuItem>
                    </>
                  )
                }}
              </Popover>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Service Catalog"
        actions={
          canWrite ? (
            <>
              <Button variant="secondary" onClick={() => setPresetsOpen(true)}>
                + Category Presets
              </Button>
              <Button variant="secondary" onClick={() => setAddTypeModalOpen(true)}>
                + Add Service Type
              </Button>
              <Button onClick={() => setAddModalOpen(true)}>+ Add Service</Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search services…"
          containerClassName="max-w-xs flex-1"
        />
        <Popover
          align="start"
          trigger={({ open, toggle }) => (
            <FilterTrigger
              open={open}
              onClick={toggle}
              active={hasFilter}
              count={(statusFilter !== "active" ? 1 : 0) + (durationMin || durationMax ? 1 : 0)}
            />
          )}
          panelClassName="w-[min(90vw,22rem)] p-4"
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-body">Status</p>
              {(["all", "active", "archived"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "w-full rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors",
                    statusFilter === s ? "bg-primary-soft font-medium text-primary" : "text-body hover:bg-surface-muted",
                  )}
                >
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="space-y-2 border-t border-border-subtle pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-body">Duration (hours)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Min"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  className="w-full rounded-sm border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <span className="shrink-0 text-xs text-muted">to</span>
                <input
                  type="number"
                  min="1"
                  placeholder="Max"
                  value={durationMax}
                  onChange={(e) => setDurationMax(e.target.value)}
                  className="w-full rounded-sm border border-border px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {(durationMin || durationMax) && (
                <button
                  onClick={() => {
                    setDurationMin("")
                    setDurationMax("")
                  }}
                  className="text-xs text-muted transition-colors hover:text-status-delayed"
                >
                  Clear duration
                </button>
              )}
            </div>
          </div>
        </Popover>
      </div>

      {canWrite && (
        <>
          <AddServiceModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={fetchServices} />
          <EditServiceModal
            serviceId={editServiceId}
            open={editServiceId !== null}
            onClose={() => setEditServiceId(null)}
            onSuccess={() => {
              setEditServiceId(null)
              fetchServices()
            }}
          />
          <AddServiceTypeModal
            open={addTypeModalOpen}
            onClose={() => setAddTypeModalOpen(false)}
            onSuccess={() => setAddTypeModalOpen(false)}
          />
          <CategoryPresetsPanel open={presetsOpen} onClose={() => setPresetsOpen(false)} />
        </>
      )}

      <DataTable
        columns={columns}
        rows={services}
        rowKey={(s) => s.id}
        loading={loading}
        error={fetchError}
        emptyLabel="No services found."
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        }
      />
    </div>
  )
}
