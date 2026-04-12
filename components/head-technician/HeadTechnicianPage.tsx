"use client"

import { useState, useEffect } from "react"
import { Wrench, SlidersHorizontal } from "lucide-react"
import { HeadTechJob, Status } from "./components/types"
import { HeadTechJobCard } from "./components/HeadTechJobCard"
import { BottomNav } from "./components/BottomNav"

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "For Rework",
  "For Release",
  "Delayed",
  "Cancelled",
  "Released",
]

export default function HeadTechnicianPage() {
  const [jobs, setJobs]                   = useState<HeadTechJob[]>([])
  const [loading, setLoading]             = useState(true)
  const [statusFilter, setStatusFilter]   = useState("all")
  const [showFilters, setShowFilters]     = useState(false)

  // Read display name from localStorage
  const [displayName, setDisplayName] = useState<string>("")
  useEffect(() => {
    try {
      const stored = localStorage.getItem("826_user")
      if (stored) {
        const parsed = JSON.parse(stored)
        setDisplayName(parsed?.full_name ?? parsed?.username ?? "")
      }
    } catch {}
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res  = await fetch("/api/head-technician/jobs")
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
    return true
  })

  const ongoingCount  = jobs.filter((j) => j.status === "Ongoing").length
  const reworkCount   = jobs.filter((j) => j.status === "For Rework").length

  return (
    <>
      <main className="px-4 pt-5 pb-28 max-w-md mx-auto space-y-5">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                <Wrench size={14} className="text-white" />
              </div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                826 Auto Care
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {displayName ? `Hi, ${displayName.split(" ")[0]}` : "Active Jobs"}
            </h1>
            {displayName && (
              <p className="text-xs text-gray-400 mt-0.5">Your assigned jobs</p>
            )}
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2.5 rounded-xl border transition-all ${
              showFilters || statusFilter !== "all"
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-500"
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* ── Stat pills ──────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div className="flex gap-2">
            <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-blue-600">{ongoingCount}</p>
              <p className="text-[11px] text-blue-400 font-medium">Ongoing</p>
            </div>
            <div className="flex-1 bg-orange-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-orange-500">{reworkCount}</p>
              <p className="text-[11px] text-orange-400 font-medium">For Rework</p>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
              <p className="text-lg font-bold text-gray-700">{jobs.length}</p>
              <p className="text-[11px] text-gray-400 font-medium">Total</p>
            </div>
          </div>
        )}

        {/* ── Filter row (collapsible) ─────────────────────────────── */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-100 p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Filter by Status
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  statusFilter === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                    statusFilter === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Job list ────────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="h-3 w-24 bg-gray-100 rounded" />
                    <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  </div>
                  <div className="h-4 w-40 bg-gray-100 rounded" />
                  <div className="h-3 w-32 bg-gray-100 rounded" />
                  <div className="h-2 w-full bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job} />
          ))}

          {!loading && filteredJobs.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 px-4 py-10 text-center">
              <p className="text-sm text-gray-400">No jobs found.</p>
            </div>
          )}
        </div>
      </main>

      <BottomNav active="jobs" />
    </>
  )
}
