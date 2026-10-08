"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { fmtDateTimeShort } from "@/lib/time-display"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { statusStyle } from "@/lib/ui/status"

interface DelayedJob {
  id: string
  job_order_code: string
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
    <Card className="flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-rework" />
          <h2 className="text-sm font-semibold text-body">Delayed Jobs</h2>
          {!loading && jobs.length > 0 && (
            <Badge className={statusStyle("rework").soft}>{jobs.length}</Badge>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted">
          <RefreshCw className="h-3 w-3" /> Live
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState title="No delayed jobs" compact />
      ) : (
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs font-medium text-muted pb-2 pr-3">Job ID</th>
                <th className="text-left text-xs font-medium text-muted pb-2 pr-3">Service</th>
                <th className="text-left text-xs font-medium text-muted pb-2 pr-3">Est. Completion</th>
                <th className="text-left text-xs font-medium text-muted pb-2">Delayed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {jobs.map((job) => {
                const delayedBy = formatDelayedBy(job.expected_completion_at)
                const isOverdue = delayedBy !== "—"
                return (
                  <tr key={job.id} className="hover:bg-surface-muted transition-colors">
                    <td className="py-2 pr-3">
                      <span className="font-mono text-xs text-body">{job.job_order_code}</span>
                    </td>
                    <td className="py-2 pr-3 text-body">{job.service?.name ?? "—"}</td>
                    <td className="py-2 pr-3 text-body text-xs">
                      {fmtDateTimeShort(job.expected_completion_at)}
                    </td>
                    <td className="py-2">
                      {isOverdue ? (
                        <Badge className={statusStyle("delayed").soft}>+{delayedBy}</Badge>
                      ) : (
                        <Badge className={statusStyle("delayed").soft}>Delayed</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
