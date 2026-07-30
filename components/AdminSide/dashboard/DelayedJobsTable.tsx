"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface DelayedJob {
  id: string
  status: string
  expected_completion_at: string | null
  service: { name: string } | null
}

function formatDelayedBy(expectedAt: string | null): string {
  if (!expectedAt) return "—"
  const diffMs = Date.now() - new Date(expectedAt).getTime()
  if (diffMs <= 0) return "—"
  const totalMins = Math.floor(diffMs / 60000)
  if (totalMins < 60) return `${totalMins}m`
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

export function DelayedJobsTable({ initialData }: { initialData?: DelayedJob[] }) {
  const [jobs, setJobs] = useState<DelayedJob[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard")
      if (!res.ok) return
      const json = await res.json()
      setJobs(json.delayedJobs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!initialData) fetchData() }, [fetchData, initialData])
  useRealtimeRefetch("job_order", fetchData)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-700">Delayed Jobs</h2>
          {!loading && jobs.length > 0 && (
            <span className="text-xs bg-orange-100 text-orange-600 rounded-full px-2 py-0.5 font-medium">
              {jobs.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Live
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-400 py-8">
          No delayed jobs
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-3">Job ID</th>
                <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-3">Service</th>
                <th className="text-left text-xs font-medium text-gray-400 pb-2 pr-3">Est. Completion</th>
                <th className="text-left text-xs font-medium text-gray-400 pb-2">Delayed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {jobs.map((job) => {
                const delayedBy = formatDelayedBy(job.expected_completion_at)
                const isOverdue = delayedBy !== "—"
                return (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-gray-500">{shortId(job.id)}</span>
                    </td>
                    <td className="py-2 pr-3 text-gray-700">{job.service?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-gray-500 text-xs">
                      {job.expected_completion_at
                        ? new Date(job.expected_completion_at).toLocaleString("en-US", {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-2">
                      {isOverdue ? (
                        <span className="text-xs font-medium text-red-600 bg-red-50 rounded px-1.5 py-0.5">
                          +{delayedBy}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium">Status: Delayed</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
