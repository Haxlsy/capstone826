"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { browserRealtimeEnv } from "@/lib/realtime/browser-env"
import {
  realtimeHealth,
  startSupervisedChannel,
  type Binding,
  type HealthStatus,
  type ReconcileReason,
} from "@/lib/realtime/supervised-channel"

interface SubscriptionOptions {
  /** Diagnostics name (also the health group). */
  name: string
  bindings: Binding[]
  onChange: () => void
  onReconcile?: (reason: ReconcileReason) => void
  catchUp?: boolean
  enabled?: boolean
}

/**
 * Supervised postgres_changes subscription — see lib/realtime/supervised-channel.ts.
 * Callbacks are held in refs so the subscription is opened once and never torn
 * down when the caller re-renders with a fresh inline closure.
 */
export function useRealtimeSubscription({
  name,
  bindings,
  onChange,
  onReconcile,
  catchUp,
  enabled = true,
}: SubscriptionOptions) {
  const onChangeRef = useRef(onChange)
  const onReconcileRef = useRef(onReconcile)
  useEffect(() => {
    onChangeRef.current = onChange
    onReconcileRef.current = onReconcile
  })

  // Serialized so an inline array literal doesn't re-trigger the effect.
  const bindingKey = JSON.stringify(bindings)

  useEffect(() => {
    if (!enabled) return
    return startSupervisedChannel(browserRealtimeEnv, {
      name,
      bindings: JSON.parse(bindingKey) as Binding[],
      catchUp,
      onChange: () => onChangeRef.current(),
      onReconcile: (reason) => onReconcileRef.current?.(reason),
    })
  }, [name, bindingKey, catchUp, enabled])
}

/**
 * Refetches whenever one of the given tables changes.
 *
 * Requires the table to be in the `supabase_realtime` publication AND to have an
 * RLS policy the subscribing user satisfies — Realtime evaluates RLS as that
 * user, so a published table with no matching policy silently delivers nothing.
 * See supabase/migrations/20260905000002_realtime_publication_and_read_policies.sql.
 *
 * Realtime is at-most-once, so the same `refetch` also runs as catch-up after a
 * dropped connection recovers (and, with `catchUp`, shortly after the first
 * connect and when the tab returns from the background) — use `catchUp` where a
 * stale screen is costly.
 */
export function useRealtimeRefetch(
  tables: string | string[],
  refetch: () => void,
  opts: { catchUp?: boolean; enabled?: boolean } = {},
) {
  const tableKey = Array.isArray(tables) ? tables.join(",") : tables
  const bindings: Binding[] = tableKey
    .split(",")
    .filter(Boolean)
    .map((table) => ({ event: "*", table }))

  useRealtimeSubscription({
    name: `rt:${tableKey}`,
    bindings,
    onChange: refetch,
    onReconcile: refetch,
    catchUp: opts.catchUp,
    enabled: opts.enabled,
  })
}

/** "connecting" | "live" | "reconnecting" for the subscriptions in a group (default: the `inquiry` refetch). */
export function useRealtimeHealth(group: string): HealthStatus {
  return useSyncExternalStore(
    realtimeHealth.subscribe,
    () => realtimeHealth.getGroupStatus(group),
    () => "connecting",
  )
}
