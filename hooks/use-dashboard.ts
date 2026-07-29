"use client"

import { useQuery } from "@tanstack/react-query"

type DashboardData = {
  status_counts: Record<string, number>
  concern_count: number
  recent_jobs: {
    id: string
    display_id: string
    customer: string
    service: string
    status: string
    created_at: string
  }[]
  calendar_jobs: any[]
}

export function useOperationsDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["operations-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/operations/dashboard")
      if (!res.ok) throw new Error("Failed to fetch dashboard")
      return res.json()
    },
  })
}

export function useAdminDashboard() {
  return useQuery<any>({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/admin/dashboard")
      if (!res.ok) throw new Error("Failed to fetch admin dashboard")
      return res.json()
    },
  })
}
