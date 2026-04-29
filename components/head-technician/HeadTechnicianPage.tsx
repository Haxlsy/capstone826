"use client"

import { useState, useEffect } from "react"
import { Wrench, SlidersHorizontal, X, Search } from "lucide-react"
import { HeadTechJob, Status } from "./components/types"
import { HeadTechJobCard } from "./components/HeadTechJobCard"
import { BottomNav } from "./components/BottomNav"

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "For Rework",
  "Delayed",
]

export default function HeadTechnicianPage() {
  const [jobs, setJobs] = useState<HeadTechJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)

  const [displayName, setDisplayName] = useState<string>("")
  useEffect(() => {
    try {
      const stored = localStorage.getItem("826_user")
      if (stored) {
        const parsed = JSON.parse(stored)
        setDisplayName(parsed?.full_name ?? parsed?.username ?? "")
      }
    } catch { }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/head-technician/jobs")
        const json = await res.json()
        if (res.ok) setJobs(json.jobs ?? [])
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

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
              <div className="w-6 h-6 rounded-md bg-gray-900 flex items-center justify-center">
                <Wrench size={12} className="text-white" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.12em]">
                826 Auto Care
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {displayName ? `Hi, ${displayName.split(" ")[0]}` : "Active Jobs"}
            </h1>
            {displayName && (
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Your assigned jobs today</p>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`relative p-2.5 rounded-xl border transition-all duration-200 ${showFilters || isFiltered
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
          >
            <SlidersHorizontal size={16} />
            {isFiltered && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>
        </div>

        {/* ── Stat pills ──────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <StatPill
              value={jobs.length}
              label="Total"
              colorClass="text-gray-700"
              bgClass="bg-gray-50"
              subColorClass="text-gray-400"
            />
            <StatPill
              value={ongoingCount}
              label="Ongoing"
              colorClass="text-blue-600"
              bgClass="bg-blue-50"
              subColorClass="text-blue-400"
            />
            <StatPill
              value={reworkCount}
              label="Rework"
              colorClass="text-orange-500"
              bgClass="bg-orange-50"
              subColorClass="text-orange-400"
            />
          </div>
        )}

        {/* ── Search bar ──────────────────────────────────────────── */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, plate, vehicle, service…"
            className="w-full pl-8 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Filter panel (collapsible) ──────────────────────────── */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                Filter by Status
              </p>
              {isFiltered && (
                <button
                  onClick={() => { setStatusFilter("all"); setSearchQuery("") }}
                  className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={12} /> Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                label="All"
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
              />
              {STATUS_OPTIONS.map((s) => (
                <FilterChip
                  key={s}
                  label={s}
                  active={statusFilter === s}
                  onClick={() => setStatusFilter(s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Job list ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-20 bg-gray-100 rounded-full" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-4 w-36 bg-gray-100 rounded-full" />
                  <div className="h-3 w-28 bg-gray-100 rounded-full" />
                  <div className="h-2 w-full bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job} />
          ))}

          {!loading && filteredJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-12 text-center space-y-1.5">
              <p className="text-sm font-medium text-gray-500">No jobs found</p>
              {isFiltered && (
                <p className="text-xs text-gray-400">
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatPill({
  value, label, colorClass, bgClass, subColorClass
}: {
  value: number; label: string
  colorClass: string; bgClass: string; subColorClass: string
}) {
  return (
    <div className={`${bgClass} rounded-2xl px-3 py-3 text-center`}>
      <p className={`text-xl font-bold ${colorClass} leading-none`}>{value}</p>
      <p className={`text-[11px] font-medium mt-1 ${subColorClass}`}>{label}</p>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-150 ${active
          ? "bg-gray-900 text-white"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
    >
      {label}
    </button>
  )
}
