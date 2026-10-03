"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

export type OperationsDashboardData = {
  status_counts: Record<string, number>
  jobs_by_status: Record<string, { id: string; job_order_code: string; customer_name: string; service_name: string; status: string }[]>
  concern_count: number
  recent_jobs: {
    id: string
    display_id: string
    customer: string
    service: string
    status: string
    created_at: string
    is_overdue: boolean
  }[]
  calendar_jobs: any[]
}

export function useOperationsDashboard(initialData?: OperationsDashboardData) {
  const queryClient = useQueryClient()

  const query = useQuery<OperationsDashboardData>({
    queryKey: ["operations-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/operations/dashboard")
      if (!res.ok) throw new Error("Failed to fetch dashboard")
      return res.json()
    },
    initialData,
  })

  // Matches exactly what lib/operations/dashboard-data.ts's getDashboardData
  // actually reads from.
  useRealtimeRefetch(
    ["job_order", "job_order_team", "job_stage_progress", "concern"],
    useCallback(() => queryClient.invalidateQueries({ queryKey: ["operations-dashboard"] }), [queryClient]),
  )

  return query
}

// Shape returned by app/api/admin/dashboard/route.ts — NOT currently wired
// into components/AdminSide/AdminDashboard.tsx, which already fetches and
// realtime-refetches per-widget (SummaryCards, ShopPerformanceChart,
// DelayedJobsTable, TechnicianAvailability each manage themselves). This
// hook is kept ready should that ever get consolidated into one fetch.
export type AdminDashboardData = {
  activeJobCount: number
  maxCapacity: number
  chatbotEfficiency: number
  delayedJobs: { id: string; status: string; expected_completion_at: string | null; service: { name: string } | null }[]
  serviceBreakdown: { service_name: string; count: number }[]
  technicians: { id: string; full_name: string; role: string; is_available: boolean }[]
}

export function useAdminDashboard(initialData?: AdminDashboardData) {
  const queryClient = useQueryClient()

  const query = useQuery<AdminDashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard")
      if (!res.ok) throw new Error("Failed to fetch admin dashboard")
      return res.json()
    },
    initialData,
  })

  // Matches exactly what lib/admin/dashboard-data.ts's getDashboardSummary/
  // getDelayedJobs/getServiceBreakdown actually read from.
  useRealtimeRefetch(
    ["job_order", "shop_config", "inquiry", "technician"],
    useCallback(() => queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }), [queryClient]),
  )

  return query
}
