// Client component: used inside JobOrderDetail (already "use client").
import { useState } from "react"
import { ChevronDown, Copy, KeyRound, Loader2, RefreshCw, UserCog } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { ConfirmModal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import { isTechnicianAvailableToday } from "@/lib/technician-availability"
import { generateTempPassword, tempHeadUsername } from "@/lib/auth/temporary-access"
import { splitFullName } from "@/lib/name"
import { readJsonResponse } from "@/lib/client/read-json"

export interface CrewOption {
  id: string
  full_name: string
  role: string
  is_available: boolean
  available_days: string[]
  availability_override_date: string | null
}

type HeadRole = "head_detailer" | "head_installer"

const ROLE_LABEL: Record<HeadRole, string> = { head_detailer: "Head Detailer", head_installer: "Head Installer" }

/**
 * The last fallback in the Add Substitute Head Technician modal: when no head
 * technician is available, make a technician who is present the Temporary Head
 * for this job, for today only. Their login is created (or reused) by the
 * server and stops working at 11:59 PM — see
 * app/api/operations/job-orders/[id]/temporary-head/route.ts.
 */
export function TemporaryHeadSection({
  jobId,
  role,
  crew,
  onDone,
  onOpenChange,
}: {
  jobId: string
  role: HeadRole
  crew: CrewOption[]
  /** Called after a successful appointment once the credentials are dismissed. */
  onDone: () => void
  /** Lets the modal widen while this section is open (picker and form side by side). */
  onOpenChange?: (open: boolean) => void
}) {
  const toast = useToast()
  const [open, setOpenState] = useState(false)
  const setOpen = (next: boolean) => {
    setOpenState(next)
    onOpenChange?.(next)
  }
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [password, setPassword] = useState(() => generateTempPassword())
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ full_name: string; username: string; password: string } | null>(null)

  const crewRole = role === "head_detailer" ? "detailer" : "installer"
  const present = crew.filter((c) => c.role === crewRole && isTechnicianAvailableToday(c))
  const selected = present.find((c) => c.id === selectedId) ?? null
  const { first, last } = splitFullName(selected?.full_name ?? "")
  const previewUsername = tempHeadUsername(first, last)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied.")
    } catch {
      toast.error("Couldn't copy. Please write it down instead.")
    }
  }

  async function makeTemporaryHead() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/operations/job-orders/${jobId}/temporary-head`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technician_id: selected.id, role, password }),
      })
      const json = await readJsonResponse<{ username?: string; password?: string; full_name?: string }>(res)
      if (!res.ok || !json.username) throw new Error(json.error ?? "Couldn't make them temporary head.")
      setConfirming(false)
      setResult({ full_name: json.full_name ?? selected.full_name, username: json.username, password: json.password ?? password })
      toast.success(`${selected.full_name} is now Temporary ${ROLE_LABEL[role]} for today.`)
    } catch (err) {
      setConfirming(false)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  // After success: show the login to read out, then hand control back.
  if (result) {
    return (
      <div className="mt-4 space-y-3 rounded-sm border border-primary/30 bg-primary-soft/60 p-3">
        <p className="text-sm font-semibold text-heading">
          {result.full_name} is Temporary {ROLE_LABEL[role]} for today
        </p>
        <p className="text-xs text-body">Give them this login. It stops working at 11:59 PM tonight.</p>
        {([["Username", result.username], ["Password", result.password]] as const).map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-2 rounded-sm bg-surface px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
              <p className="truncate font-mono text-sm text-heading">{value}</p>
            </div>
            <button type="button" onClick={() => copy(value)} aria-label={`Copy ${label.toLowerCase()}`} className="shrink-0 rounded-sm p-1.5 text-muted hover:bg-surface-muted hover:text-body">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button size="sm" fullWidth onClick={onDone}>Done</Button>
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-border-subtle pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-primary hover:underline"
      >
        <span className="flex items-center gap-1.5">
          <UserCog className="h-3.5 w-3.5" />
          No head available? Make a technician Temporary Head
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        // Side by side on wider screens (the modal widens while this is open),
        // stacked on phones: picker on the left, login details on the right.
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <p className="text-xs text-body">
              Pick a {crewRole} who is here today. They get a login for <strong>this job only</strong>, until 11:59 PM tonight.
            </p>

            {present.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">No {crewRole}s are available today.</p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {present.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedId(c.id); setError(null) }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-sm border px-3 py-2 text-sm transition-colors",
                      selectedId === c.id ? "border-primary bg-primary-soft text-primary" : "border-border-subtle text-body hover:bg-surface-muted",
                    )}
                  >
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-[10px] capitalize text-muted">{c.role}</span>
                  </button>
                ))}
              </div>
            )}

          </div>
          <div className="min-w-0">
            {selected ? (
              <div className="space-y-2 rounded-sm border border-border-subtle bg-surface-subtle p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-muted">Name</span>
                  <span className="font-medium text-heading">{selected.full_name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-xs text-muted">Username</span>
                  <span className="font-mono text-heading" title="Confirmed after saving; it gets a number if the name is already taken.">
                    {previewUsername || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted"><KeyRound className="h-3 w-3" /> Temporary password</span>
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-heading">{password}</span>
                    <button type="button" onClick={() => setPassword(generateTempPassword())} aria-label="New password" title="New password" className="rounded-sm p-1 text-muted hover:bg-surface-muted hover:text-body">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => copy(password)} aria-label="Copy password" title="Copy" className="rounded-sm p-1 text-muted hover:bg-surface-muted hover:text-body">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </div>
                <p className="text-[11px] text-muted">Access ends today at 11:59 PM.</p>
                {error && <p className="text-xs text-status-delayed">{error}</p>}
                <Button size="sm" fullWidth onClick={() => setConfirming(true)} disabled={saving}>
                  Make Temporary Head
                </Button>
              </div>
            ) : (
              <div className="flex h-full min-h-32 items-center justify-center rounded-sm border border-dashed border-border-subtle p-4 text-center text-xs text-muted">
                Pick a {crewRole} to see their login details.
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={makeTemporaryHead}
        loading={saving}
        icon={saving ? Loader2 : UserCog}
        title={`Make ${selected?.full_name ?? "this technician"} Temporary ${ROLE_LABEL[role]}?`}
        message={`They'll get a login for this job only, until 11:59 PM tonight. This is recorded in the audit log.`}
        confirmLabel="Make Temporary Head"
      />
    </div>
  )
}
