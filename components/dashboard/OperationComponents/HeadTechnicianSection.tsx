// Rendered only inside TechnicianAvailability (a client component), so it is
// a client component too without its own "use client" entry point.
import { useState } from "react"
import { CalendarClock, Clock } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button, IconButton } from "@/components/ui/Button"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { Toggle } from "@/components/ui/Toggle"
import { FieldLabel } from "@/components/ui/Field"
import { DayPillSelector } from "@/components/ui/DayPillSelector"
import { TimeRangeInputs } from "@/components/ui/TimeRange"
import { useToast } from "@/components/ui/Toast"
import { OFFLINE_ACTION_HINT } from "@/hooks/useOfflineLock"
import { cn } from "@/lib/utils"
import { avatarColor, initials } from "@/lib/ui/avatar"
import { roleStyle } from "@/lib/ui/roles"
import { isTechnicianAvailableToday, manilaToday } from "@/lib/technician-availability"
import { OnJobList, type OnJobEntry } from "@/components/shared/OnJobList"

export interface HeadTechnician {
  id: string
  full_name: string
  role: "head_detailer" | "head_installer"
  is_available: boolean
  available_days: string[]
  work_start_time: string
  work_end_time: string
  availability_override_date: string | null
  active_jobs: OnJobEntry[]
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ROLE_LABEL: Record<HeadTechnician["role"], string> = {
  head_detailer: "Head Detailer",
  head_installer: "Head Installer",
}

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const m = mStr?.padStart(2, "0") ?? "00"
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h >= 12 ? "PM" : "AM"}`
}

const PATCH = (body: Record<string, unknown>) =>
  fetch("/api/operations/technician-availability", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "head", ...body }),
  })

/**
 * Head technicians in Operations' Technician module. They come from Admin's
 * Account Management (never added, renamed or archived here); Operations only
 * sets their working days/hours and toggles them off for the day when absent,
 * which makes every job order that needs them warn (lib/operations/head-coverage.ts).
 */
export function HeadTechnicianSection({
  heads,
  setHeads,
  isOnline,
}: {
  heads: HeadTechnician[]
  setHeads: React.Dispatch<React.SetStateAction<HeadTechnician[]>>
  isOnline: boolean
}) {
  const toast = useToast()
  const [editing, setEditing] = useState<HeadTechnician | null>(null)
  const [days, setDays] = useState<string[]>(ALL_DAYS)
  const [start, setStart] = useState("08:00")
  const [end, setEnd] = useState("20:00")
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const [saving, setSaving] = useState(false)

  async function toggle(head: HeadTechnician) {
    // Today only, same as crew: the toggle resets on its own at midnight.
    const next = !isTechnicianAvailableToday(head)
    const { dateKey } = manilaToday()
    const prev = { is_available: head.is_available, availability_override_date: head.availability_override_date }
    setHeads((list) => list.map((h) => (h.id === head.id ? { ...h, is_available: next, availability_override_date: dateKey } : h)))
    try {
      const res = await PATCH({ id: head.id, is_available: next })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Could not update availability.")
      if (!next && head.active_jobs.length > 0) {
        toast.info(`${head.full_name}'s job orders now show a warning to assign a substitute.`)
      }
    } catch (err: unknown) {
      setHeads((list) => list.map((h) => (h.id === head.id ? { ...h, ...prev } : h)))
      toast.error(err instanceof Error ? err.message : "Could not update availability.")
    }
  }

  function openEdit(head: HeadTechnician) {
    setEditing(head)
    setDays(head.available_days ?? ALL_DAYS)
    setStart(head.work_start_time?.slice(0, 5) ?? "08:00")
    setEnd(head.work_end_time?.slice(0, 5) ?? "20:00")
    setFormError(null)
  }

  function review() {
    if (!editing) return
    if (end <= start) {
      setFormError("End time must be after start time.")
      return
    }
    const sameDays = [...(editing.available_days ?? [])].sort().join(",") === [...days].sort().join(",")
    if (sameDays && editing.work_start_time?.slice(0, 5) === start && editing.work_end_time?.slice(0, 5) === end) {
      toast.info("No changes to save.")
      setEditing(null)
      return
    }
    setConfirmSave(true)
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await PATCH({ id: editing.id, available_days: days, work_start_time: start, work_end_time: end })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? "Failed to save schedule.")
      setHeads((list) => list.map((h) => (
        h.id === editing.id ? { ...h, available_days: days, work_start_time: start, work_end_time: end } : h
      )))
      toast.success("Schedule updated.")
      setConfirmSave(false)
      setEditing(null)
    } catch (err: unknown) {
      setConfirmSave(false)
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const groups = (["head_detailer", "head_installer"] as const)
    .map((role) => ({ role, members: heads.filter((h) => h.role === role) }))
    .filter((g) => g.members.length > 0)

  return (
    <section>
      {groups.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle px-5 py-6 text-center text-xs text-muted">
          No head technicians match. Admin creates head technician accounts in Account Management.
        </p>
      ) : (
        <div className={cn("grid gap-6", groups.length === 1 ? "grid-cols-1" : "xl:grid-cols-2")}>
          {groups.map(({ role, members }) => {
            const availN = members.filter((m) => isTechnicianAvailableToday(m)).length
            return (
              <div key={role} className="overflow-hidden rounded-card border border-border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-5 py-3">
                  <Badge className={roleStyle(role).badge}>{ROLE_LABEL[role]}</Badge>
                  <span className="text-xs text-muted">{availN}/{members.length} available today</span>
                </div>
                <div className="max-h-[26rem] divide-y divide-border-subtle overflow-y-auto scroll-track">
                  {members.map((head) => {
                    const available = isTechnicianAvailableToday(head)
                    const onJob = head.active_jobs.length > 0
                    return (
                      <div key={head.id} className={cn("flex items-center gap-4 px-5 py-3.5", !available && "bg-status-delayed/5")}>
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", avatarColor(head.id))}>
                          {initials(head.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-heading">{head.full_name}</p>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", available ? "bg-status-inspection" : "bg-status-delayed")} />
                            <span className={cn("text-xs", available ? "text-muted" : "font-medium text-status-delayed")}>
                              {available ? "Available today" : onJob ? "Not available today · jobs need a substitute" : "Not available today"}
                            </span>
                          </div>
                          {onJob && <OnJobList jobs={head.active_jobs} linkBase="/dashboard/job-management" />}
                          <div className="mt-1.5">
                            <DayPillSelector value={head.available_days ?? ALL_DAYS} readOnly />
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 text-muted" />
                            <span className="text-[10px] text-muted">
                              {formatTime(head.work_start_time ?? "08:00:00")} – {formatTime(head.work_end_time ?? "20:00:00")}
                            </span>
                          </div>
                        </div>

                        <IconButton
                          aria-label={`Edit ${head.full_name}'s schedule`}
                          size="sm"
                          onClick={() => openEdit(head)}
                          disabled={!isOnline}
                          title={isOnline ? "Edit working days and hours" : OFFLINE_ACTION_HINT}
                        >
                          <CalendarClock className="h-4 w-4" />
                        </IconButton>
                        <span className="inline-flex" title={!isOnline ? OFFLINE_ACTION_HINT : undefined}>
                          {/* Unlike crew, allowed while on a job: an absent head on a
                              job is exactly what Operations needs to flag. */}
                          <Toggle
                            checked={available}
                            onChange={() => toggle(head)}
                            disabled={!isOnline}
                            label={`Toggle availability for ${head.full_name}`}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={editing !== null && !confirmSave}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.full_name}'s schedule` : "Schedule"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={review} disabled={saving}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Name and role are managed by Admin in Account Management. A job order booked on a day they don&apos;t work
            shows a warning to assign a substitute.
          </p>
          <div>
            <FieldLabel>Working Days</FieldLabel>
            <DayPillSelector value={days} onChange={setDays} />
          </div>
          <div>
            <FieldLabel>Working Hours</FieldLabel>
            <TimeRangeInputs start={start} end={end} onStart={setStart} onEnd={setEnd} />
          </div>
          {formError && <p className="text-xs text-status-delayed">{formError}</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmSave}
        onClose={() => !saving && setConfirmSave(false)}
        onConfirm={save}
        title="Save this schedule?"
        message={`Save ${editing?.full_name ?? "this head technician"}'s working days and hours?`}
        confirmLabel={saving ? "Saving…" : "Save Changes"}
        loading={saving}
        icon={CalendarClock}
      />
    </section>
  )
}
