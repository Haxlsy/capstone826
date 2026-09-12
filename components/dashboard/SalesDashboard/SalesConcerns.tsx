"use client"

import { useState } from "react"
import { Paperclip, CheckCircle, ArrowRight } from "lucide-react"
import type { ConcernRecord } from "@/lib/operations/concern-record"
import { useConcerns } from "@/hooks/use-concerns"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable, RowActionHint, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { Drawer } from "@/components/ui/Drawer"
import { StatusBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { avatarColor, initials } from "@/lib/ui/avatar"

type FilterType = "All" | "Pending" | "Resolved"
const FILTERS: FilterType[] = ["All", "Pending", "Resolved"]

function ReadOnlyConcernDrawer({ record, onClose }: { record: ConcernRecord | null; onClose: () => void }) {
  const isResolved = record?.status === "Resolved"
  return (
    <Drawer
      open={record !== null}
      onClose={onClose}
      title="Concern Details"
      width="md"
      footer={
        record ? (
          isResolved ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-sm bg-status-inspection/12 py-2.5 text-sm font-semibold text-status-inspection">
              <CheckCircle className="h-4 w-4" />
              Resolved
            </div>
          ) : (
            <div className="flex w-full items-center justify-center gap-2 rounded-sm bg-status-warning/12 py-2.5 text-sm font-semibold text-status-warning">
              Pending — awaiting operations response
            </div>
          )
        ) : null
      }
    >
      {record && (
        <div className="space-y-5">
          <Field label="Submitted By">
            <p className="text-sm font-semibold text-heading">{record.submitterName}</p>
            <p className="text-xs capitalize text-muted">{record.submitterRole.replace("_", " ")}</p>
          </Field>
          <Field label="Submitted">
            <p className="text-sm text-body">{record.submitted_at}</p>
          </Field>
          <Field label="Job Order">
            <p className="font-mono text-sm font-semibold text-body">{record.jobId}</p>
          </Field>
          <Field label="Title">
            <p className="text-sm font-semibold text-heading">{record.title}</p>
          </Field>
          <Field label="Description">
            <p className="text-sm leading-relaxed text-body">{record.description}</p>
          </Field>
          {record.media.length > 0 && (
            <Field label={`Attachments (${record.media.length})`} icon={<Paperclip className="h-3 w-3" />}>
              <div className="flex flex-wrap gap-2">
                {record.media.map((m) =>
                  m.media_type === "photo" ? (
                    <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.file_url}
                        alt="concern attachment"
                        className="h-16 w-16 rounded-sm border border-border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                  ) : (
                    <a
                      key={m.id}
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      ▶ Video
                    </a>
                  ),
                )}
              </div>
            </Field>
          )}
          <Field label="Response Note">
            <div className="min-h-[3rem] rounded-sm border border-border bg-surface-subtle px-3 py-2.5 text-sm text-body">
              {record.response_note ?? <span className="italic text-muted">No response yet.</span>}
            </div>
          </Field>
        </div>
      )}
    </Drawer>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-xs text-muted">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

export default function SalesConcerns({ initialRecords }: { initialRecords: ConcernRecord[] }) {
  // Shares the exact same cached + realtime-refetched query Operations'
  // Job Concerns page uses (hooks/use-concerns.ts) — same `concern` table,
  // no reason to maintain a second copy of this live-data logic.
  const { data: records = [] } = useConcerns(initialRecords)
  const [activeFilter, setActiveFilter] = useState<FilterType>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)
  const [selected, setSelected] = useState<ConcernRecord | null>(null)

  const filtered = records.filter((r) => {
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

  return (
    <>
      <div className="flex flex-col gap-5">
        <PageHeader title="View Concerns" subtitle="Read-only reference view of submitted job concerns." />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchBar
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v)
              setCurrentPage(1)
            }}
            placeholder="Search by technician, job ID, or title…"
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

      <ReadOnlyConcernDrawer record={selected} onClose={() => setSelected(null)} />
    </>
  )
}
