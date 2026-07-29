"use client"

import { useQuery } from "@tanstack/react-query"

type Inquiry = {
  id: string
  messenger_name: string | null
  psid: string
  inquiry_type: string
  status: string
  escalated_at: string
  resolved_at: string | null
  extracted_name: string | null
  extracted_contact: string | null
  extracted_plate: string | null
  extracted_vehicle: string | null
  extracted_email: string | null
  last_message: string | null
  resolver: { full_name: string } | null
}

export function useInquiries(type = "all", status = "all") {
  const params = new URLSearchParams()
  if (type !== "all") params.set("type", type)
  if (status !== "all") params.set("status", status)

  return useQuery<Inquiry[]>({
    queryKey: ["inquiries", { type, status }],
    queryFn: async () => {
      const res = await fetch(`/api/sales/inquiries?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch inquiries")
      const json = await res.json()
      return json.inquiries ?? []
    },
  })
}
