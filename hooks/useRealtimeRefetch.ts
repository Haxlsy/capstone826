"use client"

import { useEffect, useId, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Refetches whenever one of the given tables changes.
 *
 * Requires the table to be in the `supabase_realtime` publication AND to have an
 * RLS policy the subscribing user satisfies — Realtime evaluates RLS as that
 * user, so a published table with no matching policy silently delivers nothing.
 * See supabase/migrations/20260905000002_realtime_publication_and_read_policies.sql.
 *
 * `refetch` is held in a ref so the subscription is opened once and never torn
 * down when the caller re-renders: passing an inline closure (as every caller
 * does) would otherwise either resubscribe on every render, or — with an empty
 * dependency array, as this hook previously had — keep calling the *first*
 * render's closure and refetch against stale state.
 */
export function useRealtimeRefetch(tables: string | string[], refetch: () => void) {
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  // Stable per component instance. A random channel name (the previous
  // approach) leaked a fresh channel on every remount.
  const instanceId = useId()

  // Serialized so an inline array literal doesn't re-trigger the effect.
  const tableKey = Array.isArray(tables) ? tables.join(",") : tables

  useEffect(() => {
    const supabase = createClient()
    const tableList = tableKey.split(",").filter(Boolean)

    const channels = tableList.map((table) =>
      supabase
        .channel(`realtime:${table}:${instanceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          refetchRef.current()
        })
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [tableKey, instanceId])
}
