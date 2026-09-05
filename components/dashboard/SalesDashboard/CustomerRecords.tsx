"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import { Car, Phone, Mail, Pencil, X, Check } from "lucide-react"
import { getInitials } from "@/hooks/useCurrentUser"
import { fmtDate } from "@/lib/time-display"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import { LinkAccountModal } from "./LinkAccountModal"

interface CustomerRecord {
  id: string
  fullName: string
  contactNumber: string
  email: string | null
  plateNumber: string
  vehicleUnit: string
  psid: string | null
  createdAt: string
}

export default function CustomerRecords() {
  const toast = useToast()
  const [records, setRecords] = useState<CustomerRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const isFirstRender = useRef(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<CustomerRecord>>({})
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  const [linkTargetId, setLinkTargetId] = useState<string | null>(null)

  const load = useCallback(async (q = "") => {
    setLoading(true)
    setFetchErr(null)
    try {
      const res = await fetch(`/api/sales/customer-records${q ? `?search=${encodeURIComponent(q)}` : ""}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load records")
      const shaped: CustomerRecord[] = (json.records ?? []).map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        contactNumber: r.contact_number,
        email: r.email ?? null,
        plateNumber: r.plate_number,
        vehicleUnit: r.vehicle_unit,
        psid: r.psid ?? null,
        createdAt: fmtDate(r.created_at),
      }))
      setRecords(shaped)
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      load()
      return
    }
    const t = setTimeout(() => {
      load(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search, load])

  // Live updates when a record is created from an inquiry or edited elsewhere.
  // Re-runs with the active search term so the visible filter is preserved.
  useRealtimeRefetch("customer_record", () => load(search))

  function startEdit(record: CustomerRecord) {
    setEditingId(record.id)
    setEditDraft({
      fullName: record.fullName,
      contactNumber: record.contactNumber,
      email: record.email ?? "",
      plateNumber: record.plateNumber,
      vehicleUnit: record.vehicleUnit,
    })
    setSaveErr(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
    setSaveErr(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setSaveErr(null)
    try {
      const res = await fetch(`/api/sales/customer-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editDraft.fullName,
          contact_number: editDraft.contactNumber,
          email: editDraft.email || null,
          plate_number: editDraft.plateNumber,
          vehicle_unit: editDraft.vehicleUnit,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to save")

      setRecords((prev) =>
        prev.map((r) => (r.id === id ? ({ ...r, ...editDraft } as CustomerRecord) : r)),
      )
      setEditingId(null)
      setEditDraft({})
      toast.success("Customer record updated.")
    } catch (err: unknown) {
      setSaveErr(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const editCell = "h-8 text-sm"

  const columns: Column<CustomerRecord>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (record) => {
        const isEditing = editingId === record.id
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-body">
              {getInitials(record.fullName)}
            </span>
            {isEditing ? (
              <Input
                aria-label="Full name"
                className={cn(editCell, "w-40")}
                value={editDraft.fullName ?? ""}
                onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
              />
            ) : (
              <div>
                <p className="font-medium text-heading">{record.fullName}</p>
                {record.psid ? (
                  <button
                    onClick={() => setLinkTargetId(record.id)}
                    className="font-mono text-[11px] text-muted hover:text-primary hover:underline"
                    title="Click to relink"
                  >
                    {record.psid}
                  </button>
                ) : (
                  <button
                    onClick={() => setLinkTargetId(record.id)}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Link Messenger Account
                  </button>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (record) =>
        editingId === record.id ? (
          <Input
            aria-label="Vehicle unit"
            className={cn(editCell, "w-36")}
            value={editDraft.vehicleUnit ?? ""}
            onChange={(e) => setEditDraft((d) => ({ ...d, vehicleUnit: e.target.value }))}
          />
        ) : (
          <span className="text-body">{record.vehicleUnit}</span>
        ),
    },
    {
      key: "plate",
      header: "Plate Number",
      cell: (record) =>
        editingId === record.id ? (
          <Input
            aria-label="Plate number"
            className={cn(editCell, "w-28")}
            value={editDraft.plateNumber ?? ""}
            onChange={(e) => setEditDraft((d) => ({ ...d, plateNumber: e.target.value }))}
          />
        ) : (
          <span className="flex items-center gap-2">
            <Car className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="font-mono font-medium text-body">{record.plateNumber}</span>
          </span>
        ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (record) =>
        editingId === record.id ? (
          <Input
            aria-label="Contact number"
            className={cn(editCell, "w-36")}
            value={editDraft.contactNumber ?? ""}
            onChange={(e) => setEditDraft((d) => ({ ...d, contactNumber: e.target.value }))}
          />
        ) : (
          <span className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-body">{record.contactNumber}</span>
          </span>
        ),
    },
    {
      key: "email",
      header: "Email",
      cell: (record) =>
        editingId === record.id ? (
          <Input
            aria-label="Email"
            type="email"
            className={cn(editCell, "w-44")}
            value={editDraft.email ?? ""}
            onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
          />
        ) : (
          <span className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-sm text-body">{record.email ?? <span className="text-muted">—</span>}</span>
          </span>
        ),
    },
    { key: "recorded", header: "Recorded", cell: (record) => <span className="text-xs text-muted">{record.createdAt}</span> },
    {
      key: "actions",
      header: "",
      cell: (record) =>
        editingId === record.id ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => saveEdit(record.id)} disabled={saving}>
                <Check className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="subtle" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
            {saveErr && <p className="text-[11px] text-status-delayed">{saveErr}</p>}
          </div>
        ) : (
          <Button size="sm" variant="subtle" onClick={() => startEdit(record)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Customer Records" subtitle="Confirmed customer details from booking inquiries." />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search by name, plate, or contact…"
        containerClassName="max-w-sm"
      />

      <DataTable
        columns={columns}
        rows={records}
        rowKey={(r) => r.id}
        loading={loading}
        error={fetchErr}
        emptyLabel="No records found."
      />

      <LinkAccountModal
        open={linkTargetId !== null}
        onClose={() => setLinkTargetId(null)}
        initialRecordId={linkTargetId ?? undefined}
        onLinked={(id, psid) =>
          setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, psid } : r)))
        }
      />
    </div>
  )
}
