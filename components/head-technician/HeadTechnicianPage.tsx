"use client"

import { useState } from "react"
import { Wrench, SlidersHorizontal, X, Search, Layers, RefreshCw } from "lucide-react"
import { Status } from "./components/types"
import { HeadTechJobCard } from "./components/HeadTechJobCard"
import { BottomNav } from "./components/BottomNav"
import { StatCard } from "@/components/ui/StatCard"
import { Tabs } from "@/components/ui/Tabs"
import type { TechnicianJob } from "@/lib/head-technician/jobs-data"

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "For Rework",
  "Delayed",
]

export default function HeadTechnicianPage({
  initialJobs,
  displayName,
}: {
  initialJobs: TechnicianJob[]
  displayName: string
}) {
  const [jobs] = useState<TechnicianJob[]>(initialJobs)
  const loading = false
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== (statusFilter as Status)) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches =
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

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative p-2.5 rounded-card border transition-all duration-200 ${showFilters || isFiltered
                ? "bg-primary border-primary text-white"
                : "bg-surface border-border text-body hover:border-primary/40"
              }`}
          >
            <SlidersHorizontal size={16} />
            {isFiltered && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Total" value={jobs.length} icon={Layers} tone="total" />
            <StatCard label="Ongoing" value={ongoingCount} icon={Wrench} tone="ongoing" />
            <StatCard label="Rework" value={reworkCount} icon={RefreshCw} tone="rework" />
          </div>
        )}

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, plate, vehicle, service…"
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

        {/* ── Filter panel (collapsible) ──────────────────────────── */}
        {showFilters && (
          <div className="bg-surface rounded-card border border-border-subtle shadow-sm p-4 space-y-3">
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
        )}

        {/* ── Job list ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface rounded-card border border-border-subtle p-4 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-20 bg-surface-muted rounded-full" />
                    <div className="h-5 w-16 bg-surface-muted rounded-full" />
                  </div>
                  <div className="h-4 w-36 bg-surface-muted rounded-full" />
                  <div className="h-3 w-28 bg-surface-muted rounded-full" />
                  <div className="h-2 w-full bg-surface-muted rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job as any} />
          ))}

          {!loading && filteredJobs.length === 0 && (
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

