"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Users, Clock, RefreshCw } from "lucide-react"

interface TeamEntry {
  job_id:          string
  display_id:      string
  customer:        string
  service:         string
  actual_start_at: string | null
  head_detailer:   string | null
  head_installer:  string | null
  detailers:       string[]
  installers:      string[]
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

function CrewList({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (names.length === 0) return <span className="text-gray-400 text-xs italic">None assigned</span>

  const visible = expanded || names.length <= 2 ? names : names.slice(0, 2)

  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((n, i) => (
        <span key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{n}</span>
      ))}
      {names.length > 2 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
        >
          {expanded ? "less" : `+${names.length - 2} more`}
        </button>
      )}
    </span>
  )
}

export default function TeamSchedulePanel() {
  const [teams, setTeams]       = useState<TeamEntry[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch("/api/operations/team-schedule")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load team schedule")
      setTeams(json.teams ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-white rounded-xl border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">Live Team Activity</span>
          {!loading && (
            <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
              {teams.length} ongoing
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-red-500">{error}</div>
        ) : teams.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No ongoing jobs right now.</div>
        ) : (
          teams.map((t) => (
            <div key={t.job_id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
              {/* Job title row */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/job-management/${t.job_id}`}
                    className="text-sm font-semibold text-gray-800 hover:text-blue-600 transition-colors truncate block"
                  >
                    {t.customer}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5">{t.service}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {fmtTime(t.actual_start_at)}
                </div>
              </div>

              {/* Team grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <p className="text-gray-400 mb-1 font-medium uppercase tracking-wide" style={{ fontSize: "10px" }}>
                    Head Detailer
                  </p>
                  <span className="text-gray-700 font-medium">{t.head_detailer ?? "—"}</span>
                </div>
                <div>
                  <p className="text-gray-400 mb-1 font-medium uppercase tracking-wide" style={{ fontSize: "10px" }}>
                    Head Installer
                  </p>
                  <span className="text-gray-700 font-medium">{t.head_installer ?? "—"}</span>
                </div>
                {t.detailers.length > 0 && (
                  <div>
                    <p className="text-gray-400 mb-1 font-medium uppercase tracking-wide" style={{ fontSize: "10px" }}>
                      Detailers
                    </p>
                    <CrewList names={t.detailers} />
                  </div>
                )}
                {t.installers.length > 0 && (
                  <div>
                    <p className="text-gray-400 mb-1 font-medium uppercase tracking-wide" style={{ fontSize: "10px" }}>
                      Installers
                    </p>
                    <CrewList names={t.installers} />
                  </div>
                )}
              </div>

              {/* Job ID link */}
              <div className="mt-2.5">
                <Link
                  href={`/dashboard/job-management/${t.job_id}`}
                  className="text-xs font-mono text-gray-400 hover:text-blue-500 transition-colors"
                >
                  {t.display_id} →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
