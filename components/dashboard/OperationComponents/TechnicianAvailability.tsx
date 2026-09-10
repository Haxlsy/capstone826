"use client"

import { useState, useEffect, useCallback } from "react"
import { UserCheck, UserX, Users, Wrench, Pencil, Archive, ArchiveRestore, Clock, AlertTriangle } from "lucide-react"
import { TechnicianAvailabilitySkeleton } from "@/app/dashboard/technician-availability/loading"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button, IconButton } from "@/components/ui/Button"
import { SearchBar } from "@/components/ui/SearchBar"
import { StatCard } from "@/components/ui/StatCard"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { Toggle } from "@/components/ui/Toggle"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Popover, MenuItem } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Input, Select, FieldLabel } from "@/components/ui/Field"
import { DayPillSelector } from "@/components/ui/DayPillSelector"
import { TimeRangeInputs } from "@/components/ui/TimeRange"
import { useToast } from "@/components/ui/Toast"
import { useOfflineLock, OfflinePausedNote, OFFLINE_ACTION_HINT } from "@/hooks/useOfflineLock"
import { cn } from "@/lib/utils"
import { avatarColor, initials } from "@/lib/ui/avatar"
import { roleStyle } from "@/lib/ui/roles"
import { normalizeName, validateName } from "@/lib/name"

interface ActiveJob {
  job_id: string
  customer: string
  service: string
}

interface Technician {
  id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  role: "detailer" | "installer"
  is_available: boolean
  is_archived: boolean
  available_days: string[]
  work_start_time: string
  work_end_time: string
  active_job: ActiveJob | null
}

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const ROLE_LABEL: Record<Technician["role"], string> = { detailer: "Detailer", installer: "Installer" }
const ROLE_BADGE: Record<Technician["role"], string> = {
  detailer: roleStyle("detailer").badge,
  installer: roleStyle("installer").badge,
}
const GROUP_ORDER: Technician["role"][] = ["detailer", "installer"]

function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":")
  const h = parseInt(hStr, 10)
  const m = mStr?.padStart(2, "0") ?? "00"
  const period = h >= 12 ? "PM" : "AM"
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${m} ${period}`
}

interface TechForm {
  firstName: string
  lastName: string
  role: Technician["role"]
  days: string[]
  start: string
  end: string
}
const EMPTY_FORM: TechForm = { firstName: "", lastName: "", role: "detailer", days: ALL_DAYS, start: "08:00", end: "20:00" }

export default function TechnicianAvailability() {
  const toast = useToast()
  const { isOnline, lockProps } = useOfflineLock()
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterRole, setFilterRole] = useState<Technician["role"] | "all">("all")
  const [filterStatus, setFilterStatus] = useState<"active" | "archived" | "all">("active")

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TechForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<Technician | null>(null)

  const [archiveTarget, setArchiveTarget] = useState<Technician | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      // Archived technicians are fetched too, so the Archived filter can show
      // them and restore them without another round trip.
      const res = await fetch("/api/operations/technician-availability?status=all")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load technicians")
      setTechnicians(json.technicians ?? [])
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggle(tech: Technician) {
    const next = !tech.is_available
    setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? { ...t, is_available: next } : t)))
    try {
      const res = await fetch("/api/operations/technician-availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tech.id, is_available: next }),
      })
      if (!res.ok) {
        setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? { ...t, is_available: !next } : t)))
        toast.error("Could not update availability.")
      }
    } catch {
      setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? { ...t, is_available: !next } : t)))
      toast.error("Could not update availability.")
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setDuplicate(null)
    setAddOpen(true)
  }

  function openEdit(tech: Technician) {
    setEditingId(tech.id)
    setForm({
      firstName: tech.first_name ?? "",
      lastName: tech.last_name ?? "",
      role: tech.role,
      days: tech.available_days ?? ALL_DAYS,
      start: tech.work_start_time?.slice(0, 5) ?? "08:00",
      end: tech.work_end_time?.slice(0, 5) ?? "20:00",
    })
    setFormError(null)
    setDuplicate(null)
    setEditOpen(true)
  }

  async function submitForm(isEdit: boolean) {
    const firstName = normalizeName(form.firstName)
    const lastName = normalizeName(form.lastName)
    const nameError = validateName(firstName, "First name") ?? validateName(lastName, "Last name")
    if (nameError) {
      setFormError(nameError)
      return
    }
    if (form.end <= form.start) {
      setFormError("End time must be after start time.")
      return
    }
    const fullName = `${firstName} ${lastName}`
    const dup = technicians.find(
      (t) =>
        t.id !== editingId &&
        t.full_name.trim().toLowerCase() === fullName.toLowerCase(),
    )
    if (dup) {
      setDuplicate(dup)
      return
    }
    setSubmitting(true)
    setFormError(null)
    setDuplicate(null)
    try {
      const body = isEdit
        ? {
            id: editingId,
            first_name: firstName,
            last_name: lastName,
            role: form.role,
            available_days: form.days,
            work_start_time: form.start,
            work_end_time: form.end,
          }
        : {
            first_name: firstName,
            last_name: lastName,
            role: form.role,
            available_days: form.days,
            work_start_time: form.start,
            work_end_time: form.end,
          }
      const res = await fetch("/api/operations/technician-availability", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save technician")
      if (isEdit) {
        setTechnicians((prev) =>
          prev.map((t) =>
            t.id === editingId
              ? {
                  ...t,
                  full_name: fullName,
                  first_name: firstName,
                  last_name: lastName,
                  role: form.role,
                  available_days: form.days,
                  work_start_time: form.start,
                  work_end_time: form.end,
                }
              : t,
          ),
        )
        setEditOpen(false)
        toast.success("Technician updated.")
      } else {
        setTechnicians((prev) => [...prev, { ...json.technician, active_job: null }])
        setAddOpen(false)
        toast.success("Technician added.")
      }
      setEditingId(null)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function setArchived(tech: Technician, archived: boolean) {
    const res = await fetch("/api/operations/technician-availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tech.id, is_archived: archived }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error ?? `Failed to ${archived ? "archive" : "restore"} technician`)
    setTechnicians((prev) => prev.map((t) => (t.id === tech.id ? { ...t, is_archived: archived } : t)))
  }

  async function confirmArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    setArchiveError(null)
    try {
      await setArchived(archiveTarget, true)
      setArchiveTarget(null)
      toast.success("Technician archived.")
    } catch (err: unknown) {
      setArchiveError(err instanceof Error ? err.message : String(err))
    } finally {
      setArchiving(false)
    }
  }

  async function restore(tech: Technician) {
    try {
      await setArchived(tech, false)
      toast.success("Technician restored.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  // Stats always describe the active roster, never the archived view.
  const activeTechs = technicians.filter((t) => !t.is_archived)
  const onJobCount = activeTechs.filter((t) => !!t.active_job).length
  const availableCount = activeTechs.filter((t) => t.is_available && !t.active_job).length
  const unavailableCount = activeTechs.length - availableCount - onJobCount

  const filtered = technicians.filter((t) => {
    const matchSearch = t.full_name.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === "all" || t.role === filterRole
    const matchStatus =
      filterStatus === "all" || (filterStatus === "archived" ? t.is_archived : !t.is_archived)
    return matchSearch && matchRole && matchStatus
  })

  const grouped = GROUP_ORDER.reduce<Record<string, Technician[]>>((acc, role) => {
    const members = filtered.filter((t) => t.role === role)
    if (members.length > 0) acc[role] = members
    return acc
  }, {})

  if (loading) return <TechnicianAvailabilitySkeleton />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technician Availability"
        subtitle="View and manage which technicians are available for assignment."
        actions={
          <Button onClick={openAdd} {...lockProps}>
            <span className="text-base leading-none">+</span> Add Technician
          </Button>
        }
      />
      {!isOnline && <OfflinePausedNote className="-mt-3" />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={activeTechs.length} icon={Users} tone="total" variant="solid" />
        <StatCard label="Available" value={availableCount} icon={UserCheck} tone="inspection" variant="solid" />
        <StatCard label="On Job" value={onJobCount} icon={Wrench} tone="onjob" variant="solid" />
        <StatCard label="Not Available" value={unavailableCount} icon={UserX} tone="delayed" variant="solid" />
      </div>

      <div className="flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search technician…"
          containerClassName="max-w-xs flex-1"
        />
        <Popover
          align="start"
          trigger={({ toggle: t, open }) => (
            <FilterTrigger
              open={open}
              onClick={t}
              active={filterRole !== "all" || filterStatus !== "active"}
              count={(filterRole !== "all" ? 1 : 0) + (filterStatus !== "active" ? 1 : 0)}
              label={filterRole === "all" ? "Filter technicians" : `Filter: ${ROLE_LABEL[filterRole]}`}
            />
          )}
        >
          {(close) => (
            <>
              <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted">Role</p>
              {(["all", "detailer", "installer"] as const).map((r) => (
                <MenuItem
                  key={r}
                  onClick={() => {
                    setFilterRole(r)
                    close()
                  }}
                  className={filterRole === r ? "bg-primary-soft text-primary" : undefined}
                >
                  {r === "all" ? "All Roles" : ROLE_LABEL[r]}
                </MenuItem>
              ))}
              <p className="mt-1 border-t border-border-subtle px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Status
              </p>
              {(["active", "archived", "all"] as const).map((s) => (
                <MenuItem
                  key={s}
                  onClick={() => {
                    setFilterStatus(s)
                    close()
                  }}
                  className={filterStatus === s ? "bg-primary-soft text-primary" : undefined}
                >
                  {s === "all" ? "All Status" : s === "active" ? "Active" : "Archived"}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
      </div>

      {fetchError ? (
        <EmptyState title="Could not load technicians" message={fetchError} />
      ) : (
        <div className={cn("grid gap-6", Object.keys(grouped).length === 1 ? "grid-cols-1" : "xl:grid-cols-2")}>
          {Object.entries(grouped).map(([role, members]) => {
            const activeMembers = members.filter((m) => !m.is_archived)
            const onJobN = activeMembers.filter((m) => m.active_job).length
            const availN = activeMembers.filter((m) => m.is_available && !m.active_job).length
            return (
              <div key={role} className="overflow-hidden rounded-card border border-border-subtle bg-surface">
                <div className="flex items-center justify-between border-b border-border-subtle bg-surface-subtle px-5 py-3">
                  <Badge className={ROLE_BADGE[role as Technician["role"]]}>
                    {ROLE_LABEL[role as Technician["role"]]}
                  </Badge>
                  <span className="text-xs text-muted">
                    {onJobN > 0 && <span className="font-medium text-status-onjob">{onJobN} on job · </span>}
                    {availN}/{activeMembers.length} available
                  </span>
                </div>
                <div className="max-h-[26rem] divide-y divide-border-subtle overflow-y-auto scroll-track">
                  {members.map((tech) => {
                    const onJob = !!tech.active_job
                    return (
                      <div
                        key={tech.id}
                        className={cn(
                          "flex items-center gap-4 px-5 py-3.5",
                          onJob && "bg-status-onjob/5",
                          tech.is_archived && "bg-surface-subtle/60",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            avatarColor(tech.id),
                          )}
                        >
                          {initials(tech.full_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-heading">{tech.full_name}</p>
                          {tech.is_archived ? (
                            <div className="mt-0.5">
                              <Badge className="bg-surface-muted text-muted">Archived</Badge>
                            </div>
                          ) : onJob ? (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Wrench className="h-3 w-3 shrink-0 text-status-onjob" />
                              <span className="truncate text-xs font-medium text-status-onjob">
                                On Job — {tech.active_job?.customer}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  tech.is_available ? "bg-status-inspection" : "bg-border",
                                )}
                              />
                              <span className="text-xs text-muted">
                                {tech.is_available ? "Available" : "Not Available"}
                              </span>
                            </div>
                          )}
                          <div className="mt-1.5">
                            <DayPillSelector value={tech.available_days ?? ALL_DAYS} readOnly />
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0 text-muted" />
                            <span className="text-[10px] text-muted">
                              {formatTime(tech.work_start_time ?? "08:00:00")} –{" "}
                              {formatTime(tech.work_end_time ?? "20:00:00")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <IconButton
                            aria-label="Edit technician"
                            size="sm"
                            onClick={() => openEdit(tech)}
                            disabled={onJob || tech.is_archived || !isOnline}
                            title={
                              !isOnline
                                ? OFFLINE_ACTION_HINT
                                : tech.is_archived
                                  ? "Restore this technician to edit their details"
                                  : onJob
                                    ? "Cannot edit while on an active job"
                                    : "Edit details"
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          {tech.is_archived ? (
                            <IconButton
                              aria-label="Restore technician"
                              size="sm"
                              variant="ghost"
                              onClick={() => restore(tech)}
                              title={isOnline ? "Restore to the active roster" : OFFLINE_ACTION_HINT}
                              {...lockProps}
                            >
                              <ArchiveRestore className="h-4 w-4" />
                            </IconButton>
                          ) : (
                            <IconButton
                              aria-label="Archive technician"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setArchiveTarget(tech)
                                setArchiveError(null)
                              }}
                              disabled={onJob || !isOnline}
                              title={
                                !isOnline
                                  ? OFFLINE_ACTION_HINT
                                  : onJob
                                    ? "Cannot archive while on an active job"
                                    : "Archive technician"
                              }
                              className="hover:bg-status-delayed/10 hover:text-status-delayed"
                            >
                              <Archive className="h-4 w-4" />
                            </IconButton>
                          )}
                        </div>

                        <span className="inline-flex" title={!isOnline ? OFFLINE_ACTION_HINT : undefined}>
                          <Toggle
                            checked={onJob ? true : tech.is_available}
                            onChange={() => toggle(tech)}
                            disabled={onJob || tech.is_archived || !isOnline}
                            label={`Toggle availability for ${tech.full_name}`}
                          />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <EmptyState
              className="xl:col-span-2"
              title={
                technicians.length === 0
                  ? 'No technicians yet. Click "Add Technician" to get started.'
                  : filterStatus === "archived"
                    ? "No archived technicians."
                    : "No technicians match your search."
              }
            />
          )}
        </div>
      )}

      <TechFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Technician"
        form={form}
        setForm={setForm}
        error={formError}
        duplicate={duplicate}
        roleBadge={ROLE_BADGE}
        roleLabel={ROLE_LABEL}
        submitting={submitting}
        submitLabel="Add"
        onSubmit={() => submitForm(false)}
      />
      <TechFormModal
        open={editOpen}
        onClose={() => {
          setEditOpen(false)
          setEditingId(null)
        }}
        title="Edit Technician"
        form={form}
        setForm={setForm}
        error={formError}
        duplicate={duplicate}
        roleBadge={ROLE_BADGE}
        roleLabel={ROLE_LABEL}
        submitting={submitting}
        submitLabel="Save Changes"
        onSubmit={() => submitForm(true)}
      />

      <ConfirmModal
        open={archiveTarget !== null}
        onClose={() => {
          setArchiveTarget(null)
          setArchiveError(null)
        }}
        onConfirm={confirmArchive}
        title="Archive Technician"
        message={
          archiveError ??
          `Archive ${archiveTarget?.full_name ?? "this technician"}? They'll be removed from assignment and the roster, but their past job records stay intact. You can restore them from the Archived filter.`
        }
        confirmLabel="Archive"
        tone="danger"
        loading={archiving}
        icon={Archive}
      />
    </div>
  )
}

function TechFormModal({
  open,
  onClose,
  title,
  form,
  setForm,
  error,
  duplicate,
  roleBadge,
  roleLabel,
  submitting,
  submitLabel,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  form: TechForm
  setForm: React.Dispatch<React.SetStateAction<TechForm>>
  error: string | null
  duplicate: Technician | null
  roleBadge: Record<Technician["role"], string>
  roleLabel: Record<Technician["role"], string>
  submitting: boolean
  submitLabel: string
  onSubmit: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !form.firstName.trim() || !form.lastName.trim()}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>First Name</FieldLabel>
            <Input
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="e.g. Juan"
            />
          </div>
          <div>
            <FieldLabel>Last Name</FieldLabel>
            <Input
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="e.g. Dela Cruz"
            />
          </div>
        </div>
        <div>
          <FieldLabel>Role</FieldLabel>
          <Select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Technician["role"] }))}
          >
            <option value="detailer">Detailer</option>
            <option value="installer">Installer</option>
          </Select>
        </div>
        <div>
          <FieldLabel>Working Days</FieldLabel>
          <DayPillSelector value={form.days} onChange={(days) => setForm((f) => ({ ...f, days }))} />
        </div>
        <div>
          <FieldLabel>Working Hours</FieldLabel>
          <TimeRangeInputs
            start={form.start}
            end={form.end}
            onStart={(start) => setForm((f) => ({ ...f, start }))}
            onEnd={(end) => setForm((f) => ({ ...f, end }))}
          />
        </div>
      </div>

      {duplicate && (
        <div className="mt-3 flex items-center gap-3 rounded-sm bg-status-warning/10 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-status-warning" />
          <p className="text-xs text-status-warning">
            <span className="font-semibold">{duplicate.full_name}</span> already exists as a{" "}
            <span className={cn("inline-flex rounded-pill px-1.5 py-0.5 text-[10px] font-semibold", roleBadge[duplicate.role])}>
              {roleLabel[duplicate.role]}
            </span>
            {duplicate.is_archived && (
              <> — archived. Restore them from the Archived filter instead of adding a duplicate.</>
            )}
          </p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-status-delayed">{error}</p>}
    </Modal>
  )
}
