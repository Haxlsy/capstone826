"use client"

import { useEffect, useState } from "react"
import { Clock, Layers } from "lucide-react"
import { Drawer } from "@/components/ui/Drawer"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { categorySwatch } from "@/lib/ui/category-colors"
import { cn } from "@/lib/utils"

interface Service {
  id: string
  name: string
  service_type: string | null
  description: string | null
  estimated_duration_mins: number | null
  is_archived: boolean
  job_order_count: number
}

interface StageRow {
  id: string
  name: string
  sequence_order: number
  stage_duration_mins: number
  category_id: string | null
  category_name: string | null
  category_color: string | null
}

interface StageGroup {
  categoryId: string
  categoryName: string
  categoryColor: string
  stages: StageRow[]
}

function formatDuration(mins: number | null) {
  if (!mins) return "—"
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 24) {
    const hrsLabel = hours === 1 ? "1 hr" : `${hours} hrs`
    return rem === 0 ? hrsLabel : `${hrsLabel} ${rem} min`
  }
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  const daysLabel = days === 1 ? "1 day" : `${days} days`
  return remHours === 0 ? daysLabel : `${daysLabel} ${remHours} hrs`
}

interface ViewServiceDrawerProps {
  service: Service | null
  open: boolean
  onClose: () => void
}

/**
 * Read-only preview — deliberately separate from EditServiceModal (which stays
 * blocked while a service is in use). This has no footer/save action and never
 * writes anything, so it's safe to open regardless of the lock.
 */
export default function ViewServiceDrawer({ service, open, onClose }: ViewServiceDrawerProps) {
  const [stages, setStages] = useState<StageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const serviceId = service?.id ?? null

  useEffect(() => {
    if (!open || !serviceId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const res = await fetch(`/api/operations/services/${serviceId}`)
        const json = await res.json()
        if (cancelled) return
        if (json.error) { setError(json.error); return }
        setStages(json.stages ?? [])
      } catch {
        if (!cancelled) setError("Failed to load service details.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [open, serviceId])

  const groups: StageGroup[] = (() => {
    const seen = new Map<string, StageGroup>()
    for (const s of [...stages].sort((a, b) => a.sequence_order - b.sequence_order)) {
      if (!s.category_id) continue
      if (!seen.has(s.category_id)) {
        seen.set(s.category_id, {
          categoryId: s.category_id,
          categoryName: s.category_name ?? s.category_id,
          categoryColor: s.category_color ?? "blue",
          stages: [],
        })
      }
      seen.get(s.category_id)!.stages.push(s)
    }
    return Array.from(seen.values())
  })()

  return (
    <Drawer open={open} onClose={onClose} width="md" title={service?.name} description={service?.service_type ?? undefined}>
      {service && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={service.is_archived ? "archived" : "active"} />
            {service.job_order_count > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-status-onjob/12 px-2 py-0.5 text-[11px] font-medium text-status-onjob">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-onjob" />
                In Use · {service.job_order_count} job order{service.job_order_count === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {service.description && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Description</p>
              <p className="text-sm text-body">{service.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-muted" />
            <span className="font-medium text-heading">{formatDuration(service.estimated_duration_mins)}</span>
            <span className="text-muted">total estimated duration</span>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Layers className="h-3.5 w-3.5" /> Workflow Stages
            </p>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : error ? (
              <p className="text-sm text-status-delayed">{error}</p>
            ) : groups.length === 0 ? (
              <p className="text-sm text-muted">No stages configured.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.categoryId}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", categorySwatch(g.categoryColor).dot)} />
                      <Badge className={categorySwatch(g.categoryColor).badge}>{g.categoryName}</Badge>
                    </div>
                    <div className="space-y-1 border-l border-border-subtle pl-3.5">
                      {g.stages.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs">
                          <span className="text-body">{s.name}</span>
                          <span className="font-mono text-muted">{formatDuration(s.stage_duration_mins)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
