"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import type { ConcernRecord } from "@/lib/operations/concern-record"

export function useConcerns(initialData?: ConcernRecord[]) {
  const queryClient = useQueryClient()

  const query = useQuery<ConcernRecord[]>({
    queryKey: ["concerns"],
    queryFn: async () => {
      const res = await fetch("/api/operations/job-concerns")
      if (!res.ok) throw new Error("Failed to fetch concerns")
      const json = await res.json()
      return json.concerns ?? []
    },
    initialData,
  })

  // Shared by every caller of this hook — the Job Concerns page AND
  // DashboardShell's sidebar nav badge both call useConcerns(), so this one
  // subscription makes both live with no separate wiring in either place.
  useRealtimeRefetch(
    "concern",
    useCallback(() => queryClient.invalidateQueries({ queryKey: ["concerns"] }), [queryClient]),
  )

  return query
}
