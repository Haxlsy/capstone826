"use client"

import { useQuery } from "@tanstack/react-query"
import type { ConcernRecord } from "@/lib/operations/concern-record"

export function useConcerns(initialData?: ConcernRecord[]) {
  return useQuery<ConcernRecord[]>({
    queryKey: ["concerns"],
    queryFn: async () => {
      const res = await fetch("/api/operations/job-concerns")
      if (!res.ok) throw new Error("Failed to fetch concerns")
      const json = await res.json()
      return json.concerns ?? []
    },
    initialData,
  })
}
