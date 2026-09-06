"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Paperclip, ArrowRight } from "lucide-react"
import { ConcernsSkeleton } from "@/app/dashboard/concerns/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { StatusBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { avatarColor, initials } from "@/lib/ui/avatar"
import ConcernDetailsDrawer from "./ConcernDetailsDrawer"
import { useConcerns } from "@/hooks/use-concerns"
import type { ConcernRecord } from "@/lib/operations/concern-record"

type FilterType = "All" | "Pending" | "Resolved"
const FILTERS: FilterType[] = ["All", "Pending", "Resolved"]

export default function JobConcerns({ initialRecords }: { initialRecords: ConcernRecord[] }) {
  const queryClient = useQueryClient()
  const { data: recordsData = [], isPending: loading, error: fetchError } = useConcerns(initialRecords)

  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selected, setSelected] = useState<ConcernRecord | null>(null)

  function handleResolve(id: string, note: string) {
    queryClient.invalidateQueries({ queryKey: ["concerns"] })
    setSelected((prev) => (prev?.id === id ? { ...prev, status: "Resolved", response_note: note } : prev))
  }

  const filtered = recordsData.filter((r) => {
    const matchFilter = activeFilter === "All" || r.status === activeFilter
    const q = searchQuery.toLowerCase()
    const matchSearch =
      q === "" ||
      r.jobId.toLowerCase().includes(q) ||
      r.submitterName.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(currentPage, totalPages)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const columns: Column<ConcernRecord>[] = [
    {
      key: "tech",
      header: "Technician",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              avatarColor(r.submitterName),
            )}
          >
            {initials(r.submitterName)}
          </span>
          <div>
            <p className="text-sm text-heading">{r.submitterName}</p>
            <p className="text-xs capitalize text-muted">{r.submitterRole.replace("_", " ")}</p>
          </div>
        </div>
      ),
    },
    { key: "title", header: "Title", cell: (r) => <span className="block max-w-32 truncate text-sm font-medium text-heading">{r.title}</span> },
    { key: "desc", header: "Description", cell: (r) => <span className="block max-w-xs truncate text-sm text-body">{r.description}</span> },
    {
      key: "attach",
      header: "Attach.",
      cell: (r) =>
        r.media.length > 0 ? (
          <span className="flex items-center gap-1 text-muted">
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-xs">{r.media.length}</span>
          </span>
        ) : null,
    },
    { key: "submitted", header: "Submitted", cell: (r) => <span className="whitespace-nowrap text-xs text-muted">{r.submitted_at}</span> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      key: "go", header: "", align: "right",
      cell: () => (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
          <span className="hidden whitespace-nowrap group-hover:inline">View details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      ),
    },
  ]

  if (loading) return <ConcernsSkeleton />

  return (
    <>
      <div className="flex flex-col gap-5">
        <PageHeader title="Job Concerns" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchBar
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v)
              setCurrentPage(1)
            }}
            placeholder="Search by technician or title…"
            containerClassName="max-w-xs flex-1"
          />
          <Tabs
            variant="pill"
            items={FILTERS.map((f) => ({ key: f, label: f }))}
            value={activeFilter}
            onChange={(k) => {
              setActiveFilter(k as FilterType)
              setCurrentPage(1)
            }}
          />
        </div>

        <DataTable
          columns={columns}
          rows={paginated}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelected(r)}
          error={fetchError ? fetchError.message : null}
          emptyLabel="No concerns found."
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
              pageSizeOptions={[10, 15, 20]}
            />
          }
        />
      </div>

      <ConcernDetailsDrawer record={selected} onClose={() => setSelected(null)} onResolve={handleResolve} />
    </>
  )
}
