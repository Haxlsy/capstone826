"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

interface CustomerRecord {
  id:             string
  full_name:      string
  contact_number: string
  email:          string | null
  plate_number:   string
  vehicle_unit:   string | null
}

interface Service {
  id:                     string
  name:                   string
  estimated_duration_mins: number
}

interface HeadTech {
  id:          string
  full_name:   string
  role:        "head_detailer" | "head_installer"
  active_jobs: number
}

interface CrewMember {
  id:           string
  full_name:    string
  role:         "detailer" | "installer"
  is_available: boolean
  on_job:       boolean
}

const INPUT_CLS  = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
const SELECT_CLS = `${INPUT_CLS} disabled:opacity-50`

function CrewCheckboxList({
  label,
  members,
  selected,
  onToggle,
  loading,
  required,
}: {
  label:     string
  members:   CrewMember[]
  selected:  Set<string>
  onToggle:  (id: string) => void
  loading:   boolean
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {selected.size > 0 && (
          <span className="ml-1.5 text-blue-600 font-semibold">({selected.size} selected)</span>
        )}
      </label>
      {loading ? (
        <p className="text-xs text-gray-400 py-2">Loading…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No {label.toLowerCase()} added yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
          {members.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-3 px-3 py-2.5 ${c.on_job ? "bg-orange-50/60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => !c.on_job && onToggle(c.id)}
                disabled={c.on_job}
                className="w-4 h-4 rounded border-gray-300 disabled:opacity-40"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${c.on_job ? "text-gray-400" : "text-gray-700"}`}>{c.full_name}</p>
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                c.on_job
                  ? "bg-orange-100 text-orange-600"
                  : c.is_available
                    ? "bg-green-50 text-green-600"
                    : "bg-gray-100 text-gray-400"
              }`}>
                {c.on_job ? "On Job" : c.is_available ? "Available" : "Busy"}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AddJobOrderForm() {
  const router        = useRouter()
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [customers,   setCustomers]   = useState<CustomerRecord[]>([])
  const [services,    setServices]    = useState<Service[]>([])
  const [headTechs,   setHeadTechs]   = useState<HeadTech[]>([])
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  const [useManualCustomer,    setUseManualCustomer]    = useState(false)
  const [selectedCustomerId,   setSelectedCustomerId]   = useState<string | null>(null)
  const [manualCustomerName,   setManualCustomerName]   = useState("")
  const [manualContactNumber,  setManualContactNumber]  = useState("")
  const [manualPlateNumber,    setManualPlateNumber]    = useState("")
  const [manualVehicleUnit,    setManualVehicleUnit]    = useState("")

  const [selectedServiceId,       setSelectedServiceId]       = useState<string | null>(null)
  const [selectedHeadDetailerId,  setSelectedHeadDetailerId]  = useState<string | null>(null)
  const [selectedHeadInstallerId, setSelectedHeadInstallerId] = useState<string | null>(null)
  const [selectedDetailerIds,     setSelectedDetailerIds]     = useState<Set<string>>(new Set())
  const [selectedInstallerIds,    setSelectedInstallerIds]    = useState<Set<string>>(new Set())
  const [scheduledAt, setScheduledAt] = useState("")

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    return () => { if (redirectTimer.current) clearTimeout(redirectTimer.current) }
  }, [])

  useEffect(() => {
    async function loadRefs() {
      setLoadingRefs(true)
      try {
        const [cRes, sRes, tRes] = await Promise.all([
          fetch("/api/operations/job-management/list-customers").then((r) =>
            r.ok ? r.json() : { customers: [] }
          ),
          fetch("/api/operations/job-management/list-services").then((r) =>
            r.ok ? r.json() : { services: [] }
          ),
          fetch("/api/operations/job-management/list-technicians").then((r) =>
            r.ok ? r.json() : { technicians: [], crew_members: [] }
          ),
        ])
        setCustomers(cRes.customers ?? [])
        setServices(sRes.services ?? [])
        setHeadTechs(tRes.technicians ?? [])
        setCrewMembers(tRes.crew_members ?? [])
      } catch {
        setError("Failed to load form data. Please refresh.")
      } finally {
        setLoadingRefs(false)
      }
    }
    loadRefs()
  }, [])

  const selectedCustomer = !useManualCustomer
    ? customers.find((c) => c.id === selectedCustomerId) ?? null
    : null

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null

  const headDetailers  = headTechs.filter((t) => t.role === "head_detailer")
  const headInstallers = headTechs.filter((t) => t.role === "head_installer")
  const detailers      = crewMembers.filter((c) => c.role === "detailer")
  const installers     = crewMembers.filter((c) => c.role === "installer")

  function toggleCrew(id: string, set: Set<string>, setter: (s: Set<string>) => void) {
    // Guard: never toggle a crew member who is currently on an active job
    const member = crewMembers.find((c) => c.id === id)
    if (member?.on_job) return
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  }

  function addMinutes(dateStr: string, mins: number): string {
    if (!dateStr || !mins) return "—"
    const d = new Date(dateStr)
    d.setMinutes(d.getMinutes() + mins)
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  }

  async function handleSubmit() {
    setError(null)

    if (!useManualCustomer && !selectedCustomerId) {
      setError("Please select a customer."); return
    }
    if (useManualCustomer) {
      if (!manualCustomerName.trim())   { setError("Please enter customer name."); return }
      if (!manualContactNumber.trim())  { setError("Please enter contact number."); return }
      if (!manualPlateNumber.trim())    { setError("Please enter plate number."); return }
    }
    if (!selectedServiceId)        { setError("Please select a service."); return }
    if (!scheduledAt)              { setError("Please set a scheduled date."); return }
    if (!selectedHeadDetailerId)   { setError("Please select a Head Detailer."); return }
    if (!selectedHeadInstallerId)  { setError("Please select a Head Installer."); return }
    if (selectedDetailerIds.size === 0)  { setError("Please assign at least one Detailer."); return }
    if (selectedInstallerIds.size === 0) { setError("Please assign at least one Installer."); return }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        service_id:        selectedServiceId,
        scheduled_at:      scheduledAt,
        head_detailer_id:  selectedHeadDetailerId ?? null,
        head_installer_id: selectedHeadInstallerId ?? null,
        detailer_ids:      [...selectedDetailerIds],
        installer_ids:     [...selectedInstallerIds],
      }

      if (!useManualCustomer) {
        payload.customer_record_id = selectedCustomerId
      } else {
        payload.customer_name   = manualCustomerName.trim()
        payload.contact_number  = manualContactNumber.trim()
        payload.plate_number    = manualPlateNumber.trim()
        payload.vehicle_unit    = manualVehicleUnit.trim() || null
      }

      const res  = await fetch("/api/operations/job-management/add-job-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to create job order")

      setSuccess(true)
      redirectTimer.current = setTimeout(() => router.push("/dashboard/job-management"), 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const estimatedMins   = selectedService?.estimated_duration_mins ?? 0
  const hrs             = Math.round(estimatedMins / 60)
  const durationLabel   = estimatedMins > 0
    ? estimatedMins >= 60
      ? `${hrs} hr${hrs !== 1 ? "s" : ""}`
      : `${estimatedMins} min${estimatedMins !== 1 ? "s" : ""}`
    : "—"
  const expectedCompletion = scheduledAt && estimatedMins > 0
    ? addMinutes(scheduledAt, estimatedMins)
    : scheduledAt ? formatDate(scheduledAt) : "—"

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400">
        <span>Job Management</span>
        <span className="mx-1.5">›</span>
        <span className="text-gray-600">Add Job Order</span>
      </div>

      <h1 className="text-xl font-bold text-gray-800">Create New Job Order</h1>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Job order created! Redirecting…
        </div>
      )}

      {/* Card 1: Customer & Vehicle Details */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm text-gray-800">Customer & Vehicle Details</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select from Sales records or enter manually.</p>
        </div>

        {!useManualCustomer ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Customer <span className="text-red-500 ml-0.5">*</span></label>
                <button
                  type="button"
                  onClick={() => { setUseManualCustomer(true); setSelectedCustomerId(null); setError(null) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Enter manually
                </button>
              </div>
              <select
                value={selectedCustomerId ?? ""}
                onChange={(e) => { setSelectedCustomerId(e.target.value || null); setError(null) }}
                disabled={loadingRefs}
                className={SELECT_CLS}
              >
                <option value="">
                  {loadingRefs ? "Loading…" : customers.length === 0 ? "No customer records found" : "— Select customer —"}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name} — {c.plate_number}</option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
                <p className="text-sm font-semibold text-blue-900">{selectedCustomer.full_name}</p>
                <p className="text-xs text-blue-700">📞 {selectedCustomer.contact_number}</p>
                {selectedCustomer.email && <p className="text-xs text-blue-700">✉️ {selectedCustomer.email}</p>}
                <p className="text-xs text-blue-700">🚗 {selectedCustomer.plate_number}</p>
                {selectedCustomer.vehicle_unit && <p className="text-xs text-blue-700">Unit: {selectedCustomer.vehicle_unit}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Customer Name *</label>
                <button
                  type="button"
                  onClick={() => { setUseManualCustomer(false); setError(null) }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Select from records
                </button>
              </div>
              <input type="text" value={manualCustomerName} onChange={(e) => setManualCustomerName(e.target.value)} placeholder="e.g., Juan dela Cruz" className={INPUT_CLS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Contact Number <span className="text-red-500 ml-0.5">*</span></label>
              <input type="tel" value={manualContactNumber} onChange={(e) => setManualContactNumber(e.target.value)} placeholder="e.g., 09XX-XXX-XXXX" className={INPUT_CLS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Plate Number <span className="text-red-500 ml-0.5">*</span></label>
              <input type="text" value={manualPlateNumber} onChange={(e) => setManualPlateNumber(e.target.value)} placeholder="e.g., ABC-1234" className={INPUT_CLS} />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-xs font-medium text-gray-600">Vehicle Unit</label>
              <input type="text" value={manualVehicleUnit} onChange={(e) => setManualVehicleUnit(e.target.value)} placeholder="e.g., Toyota Vios 2020" className={INPUT_CLS} />
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Service & Schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-gray-800">Service & Schedule</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Service <span className="text-red-500 ml-0.5">*</span> </label>
            <select
              value={selectedServiceId ?? ""}
              onChange={(e) => { setSelectedServiceId(e.target.value || null); setError(null) }}
              disabled={loadingRefs}
              className={SELECT_CLS}
            >
              <option value="">{loadingRefs ? "Loading…" : services.length === 0 ? "No services found" : "— Select service —"}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Scheduled Date & Time <span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => { setScheduledAt(e.target.value); setError(null) }}
              className={INPUT_CLS}
            />
          </div>
        </div>

        {scheduledAt && (
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Scheduled Start</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{formatDate(scheduledAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Expected Completion</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{expectedCompletion}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Service</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{selectedService?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estimated Duration</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{durationLabel}</p>
            </div>
          </div>
        )}
      </div>

      {/* Card 3: Team Assignment */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-sm text-gray-800">Team Assignment</h2>
          <p className="text-xs text-gray-400 mt-0.5">All team fields are required.</p>
        </div>

        {/* Head techs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Head Detailer <span className="text-red-500">*</span></label>
            <select
              value={selectedHeadDetailerId ?? ""}
              onChange={(e) => { setSelectedHeadDetailerId(e.target.value || null); setError(null) }}
              disabled={loadingRefs}
              className={SELECT_CLS}
            >
              <option value="">— Select head detailer —</option>
              {headDetailers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.active_jobs > 0 ? ` (${t.active_jobs} active)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Head Installer <span className="text-red-500">*</span></label>
            <select
              value={selectedHeadInstallerId ?? ""}
              onChange={(e) => { setSelectedHeadInstallerId(e.target.value || null); setError(null) }}
              disabled={loadingRefs}
              className={SELECT_CLS}
            >
              <option value="">— Select head installer —</option>
              {headInstallers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}{t.active_jobs > 0 ? ` (${t.active_jobs} active)` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <CrewCheckboxList
            label="Detailers"
            required
            members={detailers}
            selected={selectedDetailerIds}
            onToggle={(id) => toggleCrew(id, selectedDetailerIds, setSelectedDetailerIds)}
            loading={loadingRefs}
          />
          <CrewCheckboxList
            label="Installers"
            required
            members={installers}
            selected={selectedInstallerIds}
            onToggle={(id) => toggleCrew(id, selectedInstallerIds, setSelectedInstallerIds)}
            loading={loadingRefs}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-3">
        <Link
          href="/dashboard/job-management"
          className="flex-1 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl text-center hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        <div className="flex-1 flex flex-col gap-2">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading || success}
            className={`w-full py-3 text-sm font-semibold text-white rounded-xl transition-colors ${
              loading || success ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {loading ? "Creating…" : success ? "Created!" : "Create Job Order"}
          </button>
        </div>
      </div>
    </div>
  )
}
