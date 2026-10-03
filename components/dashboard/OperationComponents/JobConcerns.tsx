"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Paperclip, ArrowRight } from "lucide-react"
import { ConcernsSkeleton } from "@/app/dashboard/concerns/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, RowActionHint, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { StatusBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { avatarColor, initials } from "@/lib/ui/avatar"
import ConcernDetailsDrawer from "./ConcernDetailsDrawer"
import { useConcerns } from "@/hooks/use-concerns"
import type { ConcernRecord } from "@/lib/operations/concern-record"
import { logView } from "@/lib/client/log-view"

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

  useEffect(() => {
    if (selected) logView("job_concern", selected.jobId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // Deep-link from a notification (?concern=<id>) — works on arrival and when
  // already on this page. Waits for the record to be in the list (a concern
  // submitted seconds ago may not be yet; a refetch is triggered for it).
  const router = useRouter()
  const requestedConcern = useSearchParams().get("concern")
  const [handledConcern, setHandledConcern] = useState<string | null>(null)
  const requestedRecord = requestedConcern ? recordsData.find((r) => r.id === requestedConcern) : undefined
  // Param stripped → allow the same concern to be opened again by a later click.
  if (!requestedConcern && handledConcern !== null) setHandledConcern(null)
  if (requestedConcern && requestedConcern !== handledConcern && requestedRecord) {
    // Adjusting state while rendering (React's documented pattern for
    // "derive from a prop change") instead of a setState-in-effect.
    setHandledConcern(requestedConcern)
    setActiveFilter("All")
    setSearchQuery("")
    setSelected(requestedRecord)
  }
  useEffect(() => {
    if (!requestedConcern) return
    if (!requestedRecord) {
      queryClient.invalidateQueries({ queryKey: ["concerns"] })
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete("concern")
    router.replace(url.pathname + url.search)
  }, [requestedConcern, requestedRecord, queryClient, router])

  function handleResolve(id: string, note: string) {
    // Patch the list itself, not just the open drawer's local copy — while
    // offline the invalidate below is a no-op (its background refetch just
    // fails), so without this the table row keeps showing "Pending" and
    // reopening it offers an active "Mark as Resolved" button again, with no
    // memory that a resolution is already queued.
    queryClient.setQueryData<ConcernRecord[]>(["concerns"], (old) =>
      old?.map((r) => (r.id === id ? { ...r, status: "Resolved", response_note: note } : r)),
    )
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
    { key: "go", header: "", align: "right", cell: () => <RowActionHint icon={ArrowRight} /> },
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
