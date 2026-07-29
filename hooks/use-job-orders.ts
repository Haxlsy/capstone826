"use client"

import { useQuery } from "@tanstack/react-query"

type JobOrder = {
  id: string
  customer_name: string
  plate_number: string
  vehicle_unit: string
  contact_number: string
  service: string
  head_detailer: string
  head_installer: string
  status: string
  scheduled_at: string | null
  actual_start_at: string | null
  expected_completion_at: string | null
  released_at: string | null
  created_at: string
  progress: number
  is_overdue: boolean
}

export function useJobOrders(released = false) {
  return useQuery<JobOrder[]>({
    queryKey: ["job-orders", { released }],
    queryFn: async () => {
      const res = await fetch(
        `/api/operations/job-management/list-job-orders${released ? "?released=1" : ""}`
      )
      if (!res.ok) throw new Error("Failed to fetch job orders")
      const json = await res.json()
      return json.job_orders ?? []
    },
  })
}
