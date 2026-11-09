"use client"

import { useCallback, useEffect, useState } from "react"
import { Briefcase, Gauge, MessageSquare, Pencil, RefreshCw } from "lucide-react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Popover } from "@/components/ui/Popover"
import { ConfirmModal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { capacityStatus } from "@/lib/admin/capacity"

interface DashboardData {
  activeJobCount: number
  maxCapacity: number
  chatbotEfficiency: number
}

const TONE_COLOR = {
  ok: "bg-status-inspection",
  busy: "bg-status-warning",
  full: "bg-status-delayed",
} as const

const MIN_CAPACITY = 1
const MAX_CAPACITY = 1000

export function SummaryCards({ initialData }: { initialData?: DashboardData }) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard")
      if (!res.ok) return
      const json = await res.json()
      setData({
        activeJobCount: json.activeJobCount,
        maxCapacity: json.maxCapacity,
        chatbotEfficiency: json.chatbotEfficiency,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!initialData) fetchData() }, [fetchData, initialData])
  useRealtimeRefetch(["job_order", "inquiry", "shop_config"], fetchData)

  const activeJobCount = data?.activeJobCount ?? 0
  const maxCapacity = data?.maxCapacity ?? 15
  const capacity = capacityStatus(activeJobCount, maxCapacity)

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="animate-pulse p-5">
            <div className="h-4 w-32 bg-surface-muted rounded mb-3" />
            <div className="h-8 w-20 bg-surface-muted rounded" />
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-body">
            <Briefcase className="w-4 h-4" />
            Active Jobs Today
          </div>
          <span className="text-xs text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div>
          <div className="flex items-end gap-1">
            <span className="text-3xl font-bold text-heading">{activeJobCount}</span>
            <span className="text-lg text-muted mb-0.5">/ {maxCapacity}</span>
            <CapacityEditor
              current={maxCapacity}
              onSaved={(next) => setData((d) => (d ? { ...d, maxCapacity: next } : d))}
            />
          </div>
          <p className="text-xs text-muted mt-0.5">Scheduled today + still in progress</p>
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Daily capacity</span>
            <span>{Math.round(capacity.pct)}%</span>
          </div>
          <div className="w-full bg-surface-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${TONE_COLOR[capacity.tone]}`}
              style={{ width: `${capacity.pct}%` }}
            />
          </div>
          {capacity.over > 0 && (
            <p className="text-xs font-medium text-status-delayed mt-1.5">
              Over capacity by {capacity.over}
            </p>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-body">
            <MessageSquare className="w-4 h-4" />
            AI Chatbot Efficiency
          </div>
          <span className="text-xs text-muted flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Live
          </span>
        </div>
        <div className="flex items-end gap-1">
          <span className="text-3xl font-bold text-heading">{data?.chatbotEfficiency ?? 0}</span>
          <span className="text-lg text-muted mb-0.5">%</span>
        </div>
        <p className="text-xs text-muted">Conversations handled by Gemini without human escalation</p>
      </Card>
    </div>
  )
}

/**
 * Pencil next to "/ N": edits the shop's daily capacity in place through
 * PATCH /api/admin/shop-config (which validates 1-1000 and writes the audit log).
 * Save only checks the number; the change is written after the confirm dialog.
 */
function CapacityEditor({ current, onSaved }: { current: number; onSaved: (next: number) => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(String(current))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState<number | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(String(current))
      setError(null)
    }
    setOpen(next)
  }

  const review = () => {
    const n = Number(value)
    if (value.trim() === "" || !Number.isInteger(n) || n < MIN_CAPACITY || n > MAX_CAPACITY) {
      setError(`Enter a whole number from ${MIN_CAPACITY} to ${MAX_CAPACITY}.`)
      return
    }
    setOpen(false)
    if (n !== current) setPending(n)
  }

  const save = async () => {
    if (pending === null) return
    const n = pending
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/shop-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_capacity: n }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Back to the editor with the typed value kept, so it can be fixed.
        setPending(null)
        setError(typeof json?.error === "string" ? json.error : "Couldn't save the capacity. Try again.")
        setOpen(true)
        return
      }
      onSaved(n)
      setPending(null)
      toast.success(`Daily capacity set to ${n}`)
    } catch {
      setPending(null)
      setError("Couldn't reach the server. Check your connection and try again.")
      setOpen(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Popover
      align="start"
      open={open}
      onOpenChange={handleOpenChange}
      panelClassName="w-64 p-3"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="Edit daily capacity"
          title="Edit daily capacity"
          className="mb-1.5 ml-1 rounded-md p-1 text-muted hover:bg-surface-muted hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    >
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          review()
        }}
      >
        <label htmlFor="daily-capacity" className="block text-xs font-medium text-body">
          Daily capacity (cars per day)
        </label>
        <input
          id="daily-capacity"
          type="number"
          inputMode="numeric"
          min={MIN_CAPACITY}
          max={MAX_CAPACITY}
          step={1}
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {error && <p className="text-xs text-status-delayed">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save
          </Button>
        </div>
      </form>
    </Popover>
    <ConfirmModal
      open={pending !== null}
      onClose={() => { if (!saving) setPending(null) }}
      onConfirm={() => void save()}
      loading={saving}
      icon={Gauge}
      title="Change daily capacity?"
      message={
        <>
          Daily capacity will change from <strong>{current}</strong> to <strong>{pending}</strong> cars
          per day. This applies to every day and will be recorded in the audit trail.
        </>
      }
      confirmLabel={saving ? "Saving..." : "Change capacity"}
    />
    </>
  )
}
