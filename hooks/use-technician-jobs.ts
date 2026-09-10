"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import type { TechnicianJob } from "@/lib/head-technician/jobs-data"

type TechnicianJobsData = { jobs: TechnicianJob[]; userRole: string }

export function useTechnicianJobs(initialData?: TechnicianJobsData) {
  const queryClient = useQueryClient()

  const query = useQuery<TechnicianJobsData>({
    queryKey: ["technician-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/head-technician/jobs")
      if (!res.ok) throw new Error("Failed to fetch technician jobs")
      const json = await res.json()
      return { jobs: json.jobs ?? [], userRole: json.user_role ?? "" }
    },
    initialData,
  })

  // Matches exactly what lib/head-technician/jobs-data.ts's
  // getHeadTechnicianJobs actually reads from — a job-level change, a team
  // (re)assignment, or a stage completion should all show up here live,
  // without navigating away and back.
  useRealtimeRefetch(
    ["job_order", "job_stage_progress", "job_order_team"],
    useCallback(() => queryClient.invalidateQueries({ queryKey: ["technician-jobs"] }), [queryClient]),
  )

  return query
}
