"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Info, CheckCircle2 } from "lucide-react"

interface IntakeRecord {
  intake_id: number
  id: string
  label: string
  customer: string
  contact: string
  email: string
  plate: string
  make: string
  model: string
  color: string
  serviceType: string
  customer_id: number
  service_id: number | null
  estimated_duration_days: number
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr || !days) return "—"
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function mapRawIntake(i: any): IntakeRecord {
  const year = new Date(i.created_at).getFullYear()
  const id = `INT-${year}-${String(i.intake_id).padStart(3, "0")}`
  return {
    intake_id: i.intake_id,
    id,
    label: `${id} — ${i.customer?.full_name ?? "?"} | ${i.service?.service_name ?? "?"}`,
    customer: i.customer?.full_name ?? "—",
    contact: i.customer?.contact_number ?? "—",
    email: i.customer?.email ?? "—",
    plate: i.plate_number ?? "—",
    make: i.make ?? "",
    model: i.model ?? "",
    color: i.color ?? "—",
    serviceType: i.service?.service_name ?? "—",
    customer_id: i.customer?.customer_id ?? 0,
    service_id: i.service?.service_id ?? null,
    estimated_duration_days: i.service?.estimated_duration_days ?? 0,
  }
}

export default function AddJobOrderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedIntakeId = searchParams.get("intake_id")

  // Reference data
  const [intakeRecords, setIntakeRecords] = useState<IntakeRecord[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [techniciansList, setTechniciansList] = useState<any[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  // The resolved intake (either pre-fetched by ID or chosen from dropdown)
  const [selectedIntake, setSelectedIntake] = useState<IntakeRecord | null>(null)
  const [selectedIntakeId, setSelectedIntakeId] = useState("") // for dropdown mode

  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | null>(null)
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const hasIntake = selectedIntake !== null
  const hasDate = scheduledDate !== ""
  const estimatedDays = selectedIntake?.estimated_duration_days ?? 0
  const startDate = hasIntake && hasDate ? formatDate(scheduledDate) : "—"
  const expectedCompletion =
    hasIntake && hasDate && estimatedDays > 0
      ? addDays(scheduledDate, estimatedDays)
      : hasDate ? formatDate(scheduledDate) : "—"
  const durationLabel = estimatedDays > 0
    ? `${estimatedDays} day${estimatedDays !== 1 ? "s" : ""}`
    : "—"

  useEffect(() => {
    async function loadRefs() {
      setLoadingRefs(true)
      try {
        const [vRes, tRes, iRes] = await Promise.all([
          fetch("/api/operations/Job%20Management/list-vehicle-types"),
          fetch("/api/operations/Job%20Management/list-technicians"),
          fetch("/api/sales/intakes"),
        ])
        const [vJson, tJson, iJson] = await Promise.all([vRes.json(), tRes.json(), iRes.json()])

        setVehicleTypes(vJson.vehicle_types ?? [])
        setTechniciansList(tJson.technicians ?? [])

        const allIntakes: any[] = iJson.intakes ?? []

        if (preselectedIntakeId) {
          // Find the specific intake by ID (regardless of status)
          const raw = allIntakes.find((i: any) => i.intake_id === Number(preselectedIntakeId))
          if (raw) setSelectedIntake(mapRawIntake(raw))
        } else {
          // Dropdown mode: only show pending intakes
          const mapped = allIntakes.filter((i: any) => i.status === "pending").map(mapRawIntake)
          setIntakeRecords(mapped)
        }
      } catch {
        // ignore
      } finally {
        setLoadingRefs(false)
      }
    }
    loadRefs()
  }, [preselectedIntakeId])

  // When dropdown selection changes, update selectedIntake
  useEffect(() => {
    if (preselectedIntakeId) return
    if (!selectedIntakeId) { setSelectedIntake(null); return }
    const match = intakeRecords.find((r) => r.id === selectedIntakeId) ?? null
    setSelectedIntake(match)
  }, [selectedIntakeId, intakeRecords])

  // Auto-pick vehicle type when intake changes
  useEffect(() => {
    if (!selectedIntake || vehicleTypes.length === 0) return
    const makeModel = `${selectedIntake.make} ${selectedIntake.model}`.toLowerCase()
    const match = vehicleTypes.find((v) => makeModel.includes((v.type_name ?? "").toLowerCase()))
    setSelectedVehicleTypeId(match?.vehicle_type_id ?? vehicleTypes[0]?.vehicle_type_id ?? null)
  }, [selectedIntake, vehicleTypes])

  async function handleSubmit() {
    setError(null)
    if (!selectedIntake) { setError("Please select a customer intake record."); return }
    if (!selectedVehicleTypeId) { setError("Please select a vehicle type."); return }
    if (!scheduledDate) { setError("Please set a scheduled date."); return }

    if (!selectedIntake.customer_id || !selectedIntake.service_id) {
      setError("Selected intake is missing customer or service data. Please contact Sales.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/operations/Job%20Management/add-job-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: selectedIntake.customer_id,
          service_id: selectedIntake.service_id,
          vehicle_type_id: selectedVehicleTypeId,
          assigned_technician_id: selectedTechnicianId || null,
          plate_number: selectedIntake.plate,
          car_make: selectedIntake.make,
          car_model: selectedIntake.model,
          car_color: selectedIntake.color,
          payment_amount: 0,
          scheduled_start: scheduledDate,
          scheduled_end: estimatedDays > 0 ? addDays(scheduledDate, estimatedDays) : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to create job order")

      // Mark intake as job_created
      await fetch(`/api/sales/intakes/${selectedIntake.intake_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "job_created" }),
      })

      setSuccess(true)
      setTimeout(() => router.push("/dashboard/job-management"), 1200)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

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

      {/* Card 1: Intake Selection */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm text-gray-800">Customer Intake Reference</h2>
          <p className="text-xs text-gray-400 mt-0.5">Select a pending intake submitted by Sales.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Intake Record</label>

          {preselectedIntakeId ? (
            /* Came from Customer Intake Records — show locked field */
            loadingRefs ? (
              <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-400">
                Loading intake data…
              </div>
            ) : selectedIntake ? (
              <div className="w-full border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                {selectedIntake.label}
              </div>
            ) : (
              <div className="w-full border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-sm text-red-600">
                Could not load intake #{preselectedIntakeId}. Please go back and try again.
              </div>
            )
          ) : (
            /* Manual selection mode */
            <select
              value={selectedIntakeId}
              onChange={(e) => { setSelectedIntakeId(e.target.value); setError(null) }}
              disabled={loadingRefs}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">
                {loadingRefs ? "Loading intake records…" : intakeRecords.length === 0 ? "No pending intake records" : "— Select an intake record —"}
              </option>
              {intakeRecords.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          )}
        </div>

        {!hasIntake ? (
          <div className="text-center py-6 text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
            {loadingRefs ? "Loading…" : "Select an intake record above to auto-fill customer and vehicle details."}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-gray-400">Customer Name</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedIntake.customer}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Plate Number</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{selectedIntake.plate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Contact</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.contact}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Make / Model</p>
                <p className="text-sm text-gray-700 mt-0.5">{[selectedIntake.make, selectedIntake.model].filter(Boolean).join(" ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Color</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.color}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Service Type</p>
                <p className="text-sm font-medium text-blue-600 mt-0.5">{selectedIntake.serviceType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Vehicle Type</p>
                <select
                  value={selectedVehicleTypeId ?? ""}
                  onChange={(e) => setSelectedVehicleTypeId(e.target.value ? Number(e.target.value) : null)}
                  className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {vehicleTypes.map((v) => (
                    <option key={v.vehicle_type_id} value={v.vehicle_type_id}>{v.type_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Assignment */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-gray-800">Job Assignment</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Assigned Technician</label>
            <select
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Optional —</option>
              {techniciansList.length === 0
                ? <option disabled>No technicians currently online</option>
                : techniciansList.map((t) => (
                  <option key={t.user_id} value={t.user_id}>
                    {t.full_name} — {t.active_jobs === 0 ? "Available" : `${t.active_jobs} active job${t.active_jobs !== 1 ? "s" : ""}`}
                  </option>
                ))
              }
            </select>
            {techniciansList.length > 0 && (
              <p className="text-xs text-green-600 mt-1">{techniciansList.length} technician{techniciansList.length !== 1 ? "s" : ""} currently online</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => { setScheduledDate(e.target.value); setError(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Estimated Duration</label>
            <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">
              {durationLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm text-gray-800">Auto-Generated Timeline</h2>
          <Info className="w-4 h-4 text-gray-400" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Service Type</p>
            <p className="text-sm text-gray-700 mt-0.5">{selectedIntake?.serviceType ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Estimated Duration</p>
            <p className="text-sm text-gray-700 mt-0.5">{durationLabel}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Start Date</p>
            <p className="text-sm text-gray-700 mt-0.5">{startDate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Expected Completion</p>
            <p className="text-sm text-gray-700 mt-0.5">{expectedCompletion}</p>
          </div>
        </div>

        <p className="text-xs text-blue-500 italic">
          Timeline is auto-calculated from the service duration set by Admin and cannot be modified.
        </p>
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
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
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
