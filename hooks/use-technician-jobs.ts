"use client"

import { useQuery } from "@tanstack/react-query"

type TechnicianJob = {
  job_id: string
  raw_id: string
  customer_name: string
  plate_number: string
  car_make: string
  car_color: string
  service: string
  technician_name: string
  scheduled_start: string
  status: string
  progress: number
  stage_groups: { label: string; color: string; done: number; total: number }[]
  has_delayed_stage: boolean
}

export function useTechnicianJobs() {
  return useQuery<TechnicianJob[]>({
    queryKey: ["technician-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/head-technician/jobs")
      if (!res.ok) throw new Error("Failed to fetch technician jobs")
      const json = await res.json()
      return json.jobs ?? []
    },
  })
}
