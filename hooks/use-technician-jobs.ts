"use client"

import { useCallback, useEffect } from "react"
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
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["technician-jobs"] }),
    [queryClient],
  )

  useRealtimeRefetch(["job_order", "job_stage_progress", "job_order_team"], invalidate)

  // Realtime has no replay — an event that fires while a phone's screen is
  // locked or the app is backgrounded is missed, not just delayed; mobile
  // browsers routinely suspend the WebSocket in that state. visibilitychange
  // is the reliable signal for "back in foreground," independent of whether
  // React Query's own default focus-refetch behavior fires consistently in
  // that same context — a deterministic catch-up check either way.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") invalidate()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [invalidate])

  return query
}
