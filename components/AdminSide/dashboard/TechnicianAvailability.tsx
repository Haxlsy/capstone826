"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Card } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"

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

            const dotColor = onJob ? "bg-status-onjob" : available ? "bg-status-inspection" : "bg-border"
            const badgeLabel = onJob ? "On Job" : available ? "Available" : "Not Available"

            return (
              <li
                key={t.id}
                className="flex items-start justify-between gap-2 rounded-sm bg-surface-subtle px-3 py-2 transition-colors hover:bg-surface-muted"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotColor)} />
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-heading">{t.full_name}</span>
                    {onJob && t.active_job && (
                      <span className="block truncate text-xs text-status-onjob">
                        {t.active_job.customer} — {t.active_job.service}
                      </span>
                    )}
                    {!onJob && !worksToday && (
                      <span className="block text-xs text-muted">Not scheduled today</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted">{roleLabel(t.role)}</span>
                  <StatusBadge status={badgeLabel} className="text-xs" />
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
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-status-ongoing" />
          <h2 className="text-sm font-semibold text-body">Technician Availability</h2>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted">
          <RefreshCw className="h-3 w-3" /> Live
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <TechList title="Detailers" techs={detailers} loading={loading} />
        <div className="hidden w-px bg-surface-muted sm:block" />
        <TechList title="Installers" techs={installers} loading={loading} />
      </div>
    </Card>
  )
}
