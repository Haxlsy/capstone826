"use client"

import { useQuery } from "@tanstack/react-query"

type Concern = {
  id: string
  title: string
  description: string
  status: string
  response_note: string | null
  submitted_at: string
  resolved_at: string | null
  job: { id: string; status: string } | null
  stage: {
    id: string
    custom_name: string | null
    custom_sequence_order: number | null
    service_stage: { name: string; sequence_order: number } | null
  } | null
  submitter: { id: string; full_name: string; role: string } | null
  resolver: { full_name: string } | null
  media: { id: string; file_url: string; media_type: string }[]
  stage_name: string | null
}

export function useConcerns() {
  return useQuery<Concern[]>({
    queryKey: ["concerns"],
    queryFn: async () => {
      const res = await fetch("/api/operations/job-concerns")
      if (!res.ok) throw new Error("Failed to fetch concerns")
      const json = await res.json()
      return json.concerns ?? []
    },
  })
}
