"use client"

import { useState } from "react"
import { Clock, Database, Loader2 } from "lucide-react"
import { ConfirmModal } from "@/components/ui/Modal"
import { Select } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useRetentionPolicy, refreshRetentionPolicy } from "@/hooks/useRetentionPolicy"
import { RETENTION_MONTH_CHOICES, RETENTION_CHANGE_GRACE_DAYS } from "@/lib/retention/config"
import { RETENTION_SCOPE, periodLabel, policySummary, fmtRetentionDate } from "@/lib/retention/copy"

interface Preview {
  months: number
  currentMonths: number
  effectiveOn: string
  newlyDue: number
}

/**
 * "Data retention" in the Settings modal. Everyone sees the policy (how long
 * records are kept, what each one's clock starts from). Admins can change the
 * period here: there is no dedicated system-settings page yet
 * (docs/task/panel-recommendations.md, section 5).
 */
export default function DataRetentionSettings() {
  const policy = useRetentionPolicy()
  const { role } = useCurrentUser()
  const toast = useToast()
  const isAdmin = role === "admin" || role === "super_admin"

  const [choice, setChoice] = useState<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [saving, setSaving] = useState(false)

  const months = policy?.months ?? null
  const selected = choice ?? months ?? 6

  async function pick(next: number) {
    setChoice(next)
    if (next === months) return
    setLoadingPreview(true)
    try {
      const res = await fetch(`/api/admin/retention/preview?months=${next}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? "Could not check the change.")
      setPreview(data as Preview)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check the change.")
      setChoice(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  async function save() {
    if (!preview) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/shop-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention_months: preview.months }),
      })
      if (!res.ok) throw new Error("Could not save the retention period.")
      toast.success(`Records are now kept for ${periodLabel(preview.months)}.`)
      refreshRetentionPolicy()
      setPreview(null)
      setChoice(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the retention period.")
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    if (saving) return
    setPreview(null)
    setChoice(null)
  }

  const shorter = preview ? preview.months < preview.currentMonths : false
  const confirmMessage = preview
    ? shorter
      ? `Records will be kept for ${periodLabel(preview.months)} instead of ${periodLabel(preview.currentMonths)}. ` +
        (preview.newlyDue > 0
          ? `${preview.newlyDue} record${preview.newlyDue === 1 ? "" : "s"} will become due and be permanently deleted from ${fmtRetentionDate(new Date(preview.effectiveOn))}. `
          : "No extra records become due right away. ") +
        `Nothing is deleted for ${RETENTION_CHANGE_GRACE_DAYS} days, and everyone affected gets the weekly notice first so they can export.`
      : `Records will be kept for ${periodLabel(preview.months)} instead of ${periodLabel(preview.currentMonths)}. This takes effect right away and nothing is deleted sooner than before.`
    : ""

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-4 py-4 sm:px-6 border-b border-border-subtle">
        <div className="w-8 h-8 shrink-0 rounded-sm bg-primary/10 flex items-center justify-center">
          <Database className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Data Retention</p>
          <p className="text-xs text-muted">{policy ? policySummary(months) : "Loading the retention policy…"}</p>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 space-y-4">
        {isAdmin && (
          <div className="space-y-1.5">
            <label htmlFor="retention-months" className="block text-xs font-semibold text-body">Keep records for</label>
            <div className="flex items-center gap-2">
              <Select
                id="retention-months"
                value={selected}
                disabled={!policy || loadingPreview || saving}
                onChange={(e) => void pick(Number(e.target.value))}
                className="max-w-[12rem]"
              >
                {RETENTION_MONTH_CHOICES.map((m) => (
                  <option key={m} value={m}>{periodLabel(m)}</option>
                ))}
              </Select>
              {loadingPreview && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Checking" />}
            </div>
            <p className="text-[11px] text-muted">
              Only Admins can change this. A shorter period never deletes anything for {RETENTION_CHANGE_GRACE_DAYS} days.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Each record&apos;s clock starts at</p>
          <ul className="space-y-1">
            {RETENTION_SCOPE.map((s) => (
              <li key={s.label} className="flex gap-1.5 text-xs text-body">
                <Clock className="w-3.5 h-3.5 shrink-0 text-muted mt-0.5" aria-hidden="true" />
                <span><span className="font-medium text-heading">{s.label}:</span> {s.from}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rounded-sm bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          Deleted records can&apos;t be recovered. Each week you&apos;ll get a notice listing what will be deleted
          7 to 14 days later, so you can export it first. Records about to go are marked &quot;Expires in N days&quot;.
        </p>
      </div>

      <ConfirmModal
        open={preview !== null}
        onClose={cancel}
        onConfirm={() => void save()}
        title={`Change to ${preview ? periodLabel(preview.months) : ""}?`}
        message={confirmMessage}
        confirmLabel={saving ? "Saving…" : "Change period"}
        tone={shorter ? "danger" : "primary"}
        loading={saving}
        icon={Database}
      />
    </div>
  )
}
