"use client"

import { useState } from "react"
import { Wrench, X, Search, Layers, RefreshCw, AlertCircle } from "lucide-react"
import { Status } from "./components/types"
import { HeadTechJobCard } from "./components/HeadTechJobCard"
import { BottomNav } from "./components/BottomNav"
import { StatCard } from "@/components/ui/StatCard"
import { Tabs } from "@/components/ui/Tabs"
import { Popover } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import type { TechnicianJob } from "@/lib/head-technician/jobs-data"
import { useTechnicianJobs } from "@/hooks/use-technician-jobs"
import { displayJobStatus } from "@/lib/job-delay"

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "For Rework",
  "Delayed",
]

export default function HeadTechnicianPage({
  initialJobs,
  initialUserRole,
  displayName,
}: {
  initialJobs: TechnicianJob[]
  initialUserRole: string
  displayName: string
}) {
  // Cached (react-query, 30s staleTime) and realtime-refetched — see
  // hooks/use-technician-jobs.ts. Stays live without navigating away and
  // back; initialData means this never shows a loading state on first paint.
  const { data, isPending } = useTechnicianJobs({ jobs: initialJobs, userRole: initialUserRole })
  const jobs = data?.jobs ?? []
  const loading = isPending
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const filteredJobs = jobs.filter((job) => {
    // Compares against the DISPLAY status (job.status re-resolved through
    // displayJobStatus), not the raw one — the raw status is almost never
    // literally "Delayed" (see lib/job-delay.ts), so filtering on it
    // directly would make the "Delayed" tab match nothing.
    if (statusFilter !== "all" && displayJobStatus(job.status, job.is_overdue) !== (statusFilter as Status)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
        job.job_id?.toLowerCase().includes(q) ||
        job.customer_name?.toLowerCase().includes(q) ||
        job.plate_number?.toLowerCase().includes(q) ||
        job.car_make?.toLowerCase().includes(q) ||
        job.service?.toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const ongoingCount = jobs.filter((j) => j.status === "Ongoing").length
  const reworkCount  = jobs.filter((j) => j.status === "For Rework").length
  // is_overdue merges BOTH delay signals from lib/job-delay.ts: job-level
  // (isJobDelayed — catches a job that missed its scheduled window without
  // ever starting, still shown as "Pending") and stage-level (has_delayed_stage,
  // HeadTechJobCard's "Stage Delayed" pill). Counting only has_delayed_stage
  // here used to miss every never-started overdue job.
  const delayedCount = jobs.filter((j) => j.is_overdue).length
  const isFiltered   = statusFilter !== "all" || searchQuery.trim() !== ""

  return (
    <>
      <main className="px-4 pt-6 pb-28 max-w-md mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Wrench size={12} className="text-white" />
              </div>
              <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
                826 Auto Care
              </span>
            </div>
            <h1 className="text-xl font-bold text-heading leading-tight">
              {displayName ? `Hi, ${displayName.split(" ")[0]}` : "Active Jobs"}
            </h1>
            {displayName && (
              <p className="text-xs text-muted mt-0.5 font-medium">Your assigned jobs today</p>
            )}
          </div>

          <Popover
            align="end"
            panelClassName="w-[calc(100vw-2rem)] max-w-sm p-4"
            trigger={({ open, toggle }) => (
              <FilterTrigger
                open={open}
                onClick={toggle}
                active={isFiltered}
                count={statusFilter !== "all" ? 1 : 0}
                className="h-11 w-11 rounded-card"
              />
            )}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-muted uppercase tracking-widest">
                  Filter by Status
                </p>
                {isFiltered && (
                  <button
                    onClick={() => { setStatusFilter("all"); setSearchQuery("") }}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-body transition-colors"
                  >
                    <X size={12} /> Clear all
                  </button>
                )}
              </div>
              <Tabs
                variant="pill"
                items={[
                  { key: "all", label: "All" },
                  ...STATUS_OPTIONS.map((s) => ({ key: s, label: s })),
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </div>
          </Popover>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total" value={jobs.length} icon={Layers} tone="total" />
            <StatCard label="Ongoing" value={ongoingCount} icon={Wrench} tone="ongoing" />
            <StatCard label="Rework" value={reworkCount} icon={RefreshCw} tone="rework" />
            <StatCard label="Delayed" value={delayedCount} icon={AlertCircle} tone="delayed" />
          </div>
        )}

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by job order ID, customer, plate, vehicle, service…"
            className="w-full pl-8 pr-8 py-2.5 text-sm bg-surface border border-border rounded-card focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-border transition-all placeholder:text-muted"
          />
          {searchQuery && (
            <button
              aria-label="Search"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-body transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Job list ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job as any} />
          ))}

          {filteredJobs.length === 0 && (
            <div className="bg-surface rounded-card border border-border-subtle px-4 py-12 text-center space-y-1.5">
              <p className="text-sm font-medium text-body">No jobs found</p>
              {isFiltered && (
                <p className="text-xs text-muted">
                  Try adjusting your search or clearing the filter.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav active="jobs" />
    </>
  )
}

