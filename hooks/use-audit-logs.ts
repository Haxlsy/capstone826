"use client"

import { useState, useCallback, useEffect } from 'react';
import { ApiLog } from  "@/types/audit"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
export function useAuditLogs(initialLogs?: ApiLog[]) {
      const [logs,    setLogs]    = useState<ApiLog[]>(initialLogs ?? [])
      const [loading, setLoading] = useState(!initialLogs)
      const [fetchErr, setFetchErr] = useState<string | null>(null)

      const load = useCallback(async (opts?: { silent?: boolean }) => {
        if (!opts?.silent) setLoading(true)
        setFetchErr(null)
        try {
          const res  = await fetch("/api/admin/audit-log?limit=500")
          const json = await res.json()
          if (!res.ok) throw new Error(json?.error ?? "Failed to load audit log")
          setLogs(json.logs ?? [])
        } catch (err: unknown) {
          setFetchErr(err instanceof Error ? err.message : String(err))
        } finally {
          if (!opts?.silent) setLoading(false)
        }
      }, [])

      useEffect(() => { if (!initialLogs) load() }, [load, initialLogs])

      // audit_log is written on nearly every action across the whole app
      // (logins, job updates, resolves…) — silent, so this doesn't flash the
      // loading state on every single one while someone's reading the log.
      useRealtimeRefetch("audit_log", useCallback(() => load({ silent: true }), [load]))

      return { logs, loading, fetchErr, reload: load };
}
