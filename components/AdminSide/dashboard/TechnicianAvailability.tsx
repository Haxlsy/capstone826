"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface Technician {
  id:             string
  full_name:      string
  role:           string
  is_available:   boolean
  available_days: string[]
  active_job:     { job_id: string; customer: string; service: string } | null
}

const DETAILER_ROLES  = ["head_detailer", "detailer"]
const INSTALLER_ROLES = ["head_installer", "installer"]
const TODAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()]

function roleLabel(role: string): string {
  return role.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function TechList({ title, techs, loading }: { title: string; techs: Technician[]; loading: boolean }) {
  const availableToday = techs.filter(
    (t) => !t.active_job && t.is_available && t.available_days.includes(TODAY)
  ).length

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-body uppercase tracking-wide">{title}</span>
        {!loading && (
          <span className="text-xs text-muted">{availableToday}/{techs.length} available today</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-8 bg-surface-muted rounded animate-pulse" />
          ))}
        </div>
      ) : techs.length === 0 ? (
        <p className="text-xs text-muted py-4 text-center">No {title.toLowerCase()} assigned</p>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto max-h-72">
          {techs.map((t) => {
            const onJob      = t.active_job !== null
            const worksToday = t.available_days.includes(TODAY)
            const available  = !onJob && t.is_available && worksToday

            const dotColor   = onJob ? "bg-status-rework" : available ? "bg-status-inspection/100" : "bg-border"
            const badgeCls   = onJob
              ? "bg-status-rework/12 text-status-rework"
              : available
                ? "bg-status-inspection/12 text-status-inspection"
                : "bg-surface-muted text-body"
            const badgeLabel = onJob ? "On Job" : available ? "Available" : "Unavailable"

            return (
              <li
                key={t.id}
                className="flex items-start justify-between rounded-sm px-3 py-2 bg-surface-subtle hover:bg-surface-muted transition-colors gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dotColor}`} />
                  <div className="min-w-0">
                    <span className="text-sm text-heading truncate block">{t.full_name}</span>
                    {onJob && t.active_job && (
                      <span className="text-xs text-status-rework truncate block">
                        {t.active_job.customer} — {t.active_job.service}
                      </span>
                    )}
                    {!onJob && !worksToday && (
                      <span className="text-xs text-muted block">Not scheduled today</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted">{roleLabel(t.role)}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${badgeCls}`}>
                    {badgeLabel}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function TechnicianAvailability() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/technician-availability")
      if (!res.ok) return
      const json = await res.json()
      setTechnicians(json.technicians ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useRealtimeRefetch(["technician", "job_order_team"], fetchData)

  const detailers = technicians.filter((t) => DETAILER_ROLES.includes(t.role))
  const installers = technicians.filter((t) => INSTALLER_ROLES.includes(t.role))

  return (
    <div className="bg-surface rounded-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-status-ongoing" />
          <h2 className="text-sm font-semibold text-body">Technician Availability</h2>
        </div>
        <span className="text-xs text-muted flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Live
        </span>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <TechList title="Detailers"  techs={detailers}  loading={loading} />
        <div className="hidden sm:block w-px bg-surface-muted" />
        <TechList title="Installers" techs={installers} loading={loading} />
      </div>
    </div>
  )
}
