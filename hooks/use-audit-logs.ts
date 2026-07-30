import { useState, useCallback, useEffect } from 'react';
import { ApiLog } from  "@/types/audit"
export function useAuditLogs(initialLogs?: ApiLog[]) {
      const [logs,    setLogs]    = useState<ApiLog[]>(initialLogs ?? [])
      const [loading, setLoading] = useState(!initialLogs)
      const [fetchErr, setFetchErr] = useState<string | null>(null)
    
      const load = useCallback(async () => {
        setLoading(true)
        setFetchErr(null)
        try {
          const res  = await fetch("/api/admin/audit-log?limit=500")
          const json = await res.json()
          if (!res.ok) throw new Error(json?.error ?? "Failed to load audit log")
          setLogs(json.logs ?? [])
        } catch (err: unknown) {
          setFetchErr(err instanceof Error ? err.message : String(err))
        } finally {
          setLoading(false)
        }
      }, [])
    
      useEffect(() => { if (!initialLogs) load() }, [load, initialLogs])
      return { logs, loading, fetchErr, reload: load };
}
