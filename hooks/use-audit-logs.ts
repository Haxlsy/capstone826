"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { ApiLog, AuditRole, AuditCategory, TimePeriod } from "@/types/audit"
import type { AuditScope, AuditSortColumn, AuditSortDir } from "@/lib/admin/audit-log-query"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

export interface AuditLogParams {
  scope:    AuditScope
  role:     AuditRole | "all"
  category: AuditCategory | "all"
  action:   string | "all"
  period:   TimePeriod
  sortBy:   AuditSortColumn
  sortDir:  AuditSortDir
  page:     number
  pageSize: number
}

export function buildAuditLogSearchParams(params: AuditLogParams): URLSearchParams {
  const qs = new URLSearchParams({
    scope:    params.scope,
    period:   params.period,
    sortBy:   params.sortBy,
    sortDir:  params.sortDir,
    page:     String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.role !== "all")     qs.set("role", params.role)
  if (params.category !== "all") qs.set("category", params.category)
  if (params.action !== "all")   qs.set("action", params.action)
  return qs
}

async function fetchAuditLogs(params: AuditLogParams): Promise<{ logs: ApiLog[]; total: number; hasMore: boolean }> {
  const res  = await fetch(`/api/admin/audit-log?${buildAuditLogSearchParams(params)}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? "Failed to load audit log")
  return { logs: json.logs ?? [], total: json.total ?? 0, hasMore: json.hasMore ?? false }
}

export function useAuditLogs(params: AuditLogParams) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["audit-log", params],
    queryFn:  () => fetchAuditLogs(params),
    placeholderData: keepPreviousData,
  })

  // audit_log is written on nearly every action across the whole app (logins,
  // job updates, resolves…) — invalidate-and-background-refetch so this
  // doesn't flash the loading state on every single one while someone's
  // reading the log.
  useRealtimeRefetch("audit_log", useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
    [queryClient],
  ))

  return {
    logs:     query.data?.logs ?? [],
    total:    query.data?.total ?? 0,
    loading:  query.isPending,
    // isPending only covers the very first load — with placeholderData:
    // keepPreviousData, every later refetch (including a manual Refresh
    // click) keeps serving cached data while it reloads, so isPending never
    // goes true again and a Refresh button driven by `loading` alone would
    // never visibly spin. isFetching covers both cases.
    refreshing: query.isFetching,
    fetchErr: query.isError ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
    reload:   () => queryClient.invalidateQueries({ queryKey: ["audit-log"] }),
  }
}

/** Fetches every page matching `params` (ignoring its page/pageSize), for export. */
export async function fetchAllAuditLogs(params: Omit<AuditLogParams, "page" | "pageSize">): Promise<ApiLog[]> {
  const EXPORT_PAGE_SIZE = 200
  const all: ApiLog[] = []
  for (let page = 1; ; page++) {
    const { logs, hasMore } = await fetchAuditLogs({ ...params, page, pageSize: EXPORT_PAGE_SIZE })
    all.push(...logs)
    if (!hasMore) break
  }
  return all
}
