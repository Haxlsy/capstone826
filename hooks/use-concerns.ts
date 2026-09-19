"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import type { ConcernRecord } from "@/lib/operations/concern-record"

const OPERATIONS_ENDPOINT = "/api/operations/job-concerns"

interface Options {
  /** Each role reads its own gated route — Sales must not call the Operations one. */
  endpoint?: string
  /** Skip the fetch entirely (e.g. a shell that only needs this for Operations' badge). */
  enabled?: boolean
}

export function useConcerns(
  initialData?: ConcernRecord[],
  { endpoint = OPERATIONS_ENDPOINT, enabled = true }: Options = {},
) {
  const queryClient = useQueryClient()

  const query = useQuery<ConcernRecord[]>({
    // Operations keeps the bare ["concerns"] key (JobConcerns.tsx writes to it
    // directly); other endpoints get their own entry under the same prefix, so
    // the realtime invalidation below still refreshes all of them.
    queryKey: endpoint === OPERATIONS_ENDPOINT ? ["concerns"] : ["concerns", endpoint],
    queryFn: async () => {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error("Failed to fetch concerns")
      const json = await res.json()
      return json.concerns ?? []
    },
    initialData,
    enabled,
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
