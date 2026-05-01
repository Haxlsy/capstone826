"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function useRealtimeRefetch(tables: string | string[], refetch: () => void) {
  useEffect(() => {
    const supabase = createClient()
    const tableList = Array.isArray(tables) ? tables : [tables]

    const channels = tableList.map((table) =>
      supabase
        .channel(`realtime:${table}:${Math.random()}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          refetch()
        })
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
