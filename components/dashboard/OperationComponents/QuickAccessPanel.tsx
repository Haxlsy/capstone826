"use client"

import { useCallback, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Card, CardBody } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Sk, SkRow } from "@/components/ui/skeleton"
import { displayJobStatus } from "@/lib/job-delay"

interface RecentJob {
  id: string
  display_id: string
  customer: string
  service: string
  status: string
  is_overdue: boolean
}

interface Props {
  loading: boolean
  /** Server-rendered first paint — refreshed client-side afterward, same
   *  initialData-plus-realtime pattern as Admin's DelayedJobsTable. */
  recentJobs: RecentJob[]
}

export default function QuickAccessPanel({ loading: initialLoading, recentJobs }: Props) {
  const router = useRouter()
  const [jobs, setJobs] = useState<RecentJob[]>(recentJobs)
  const [loading, setLoading] = useState(initialLoading)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/dashboard")
      if (!res.ok) return
      const json = await res.json()
      setJobs(json.recent_jobs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useRealtimeRefetch("job_order", fetchData)

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-heading">Recent Job Orders</span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <RefreshCw className="h-3 w-3" /> Live
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkRow key={i} className="justify-between py-1">
                <div className="space-y-1.5">
                  <Sk className="h-3 w-24" />
                  <Sk className="h-4 w-32" />
                </div>
                <Sk className="h-5 w-16 rounded-full" />
              </SkRow>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState title="No Recent Job Orders" compact />
        ) : (
          <div className="flex flex-col">
            {jobs.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => router.push(`/dashboard/job-management/${item.id}`)}
                className={`flex w-full items-center justify-between py-2.5 text-left transition-colors hover:bg-surface-muted ${
                  idx < jobs.length - 1 ? "border-b border-border-subtle" : ""
                }`}
              >
                <div>
                  <p className="font-mono text-xs text-body">{item.display_id}</p>
                  <p className="mt-0.5 text-sm font-medium text-heading">{item.customer}</p>
                </div>
                <StatusBadge status={displayJobStatus(item.status, item.is_overdue)} />
              </button>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
