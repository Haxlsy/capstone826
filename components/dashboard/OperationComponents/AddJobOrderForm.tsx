"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"

interface Customer {
  customer_id: number
  full_name: string
  contact_number: string
  email: string
}

interface Service {
  service_id: number
  service_name: string
  estimated_duration_days: number
}

interface VehicleType {
  vehicle_type_id: number
  type_name: string
}

export default function AddJobOrderForm() {
  const router = useRouter()

  // Reference data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loadingRefs, setLoadingRefs] = useState(true)

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [useManualCustomer, setUseManualCustomer] = useState(false)
  const [manualCustomerName, setManualCustomerName] = useState("")
  const [manualCustomerPhone, setManualCustomerPhone] = useState("")
  const [manualCustomerEmail, setManualCustomerEmail] = useState("")
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const [selectedVehicleTypeId, setSelectedVehicleTypeId] = useState<number | null>(null)
  const [plateNumber, setPlateNumber] = useState("")
  const [carColor, setCarColor] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load reference data
  useEffect(() => {
    async function loadRefs() {
      setLoadingRefs(true)
      try {
        const [cJson, sJson, vJson] = await Promise.all([
          fetch("/api/operations/job-management/list-customers")
            .then((r) => (r.ok ? r.json() : { customers: [] as Customer[] }))
            .catch(() => ({ customers: [] as Customer[] })),
          fetch("/api/operations/job-management/list-services")
            .then((r) => (r.ok ? r.json() : { services: [] as Service[] }))
            .catch(() => ({ services: [] as Service[] })),
          fetch("/api/operations/job-management/list-vehicle-types")
            .then((r) => r.json())
            .catch(() => ({ vehicle_types: [] as VehicleType[] })),
        ])

        setCustomers(cJson.customers ?? [])
        setServices(sJson.services ?? [])
        setVehicleTypes(vJson.vehicle_types ?? [])
      } catch (err) {
        console.error("Error loading references:", err)
      } finally {
        setLoadingRefs(false)
      }
    }
    loadRefs()
  }, [])

  // Get selected customer info
  const selectedCustomer = !useManualCustomer
    ? customers.find((c) => c.customer_id === selectedCustomerId) || null
    : null
  const selectedService = services.find((s) => s.service_id === selectedServiceId) || null
  const estimatedDays = selectedService?.estimated_duration_days ?? 0

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

  async function handleSubmit() {
    setError(null)

    // Validate customer
    let customerId: number | null = null
    if (useManualCustomer) {
      if (!manualCustomerName.trim()) {
        setError("Please enter customer name.")
        return
      }
      if (!manualCustomerPhone.trim()) {
        setError("Please enter customer phone number.")
        return
      }
      if (!manualCustomerEmail.trim()) {
        setError("Please enter customer email.")
        return
      }
    } else {
      if (!selectedCustomerId) {
        setError("Please select a customer.")
        return
      }
      customerId = selectedCustomerId
    }

    if (!selectedServiceId) {
      setError("Please select a service.")
      return
    }
    if (!selectedVehicleTypeId) {
      setError("Please select a vehicle type.")
      return
    }
    if (!plateNumber.trim()) {
      setError("Please enter a plate number.")
      return
    }
    if (!carColor.trim()) {
      setError("Please enter the car color.")
      return
    }
    if (!scheduledDate) {
      setError("Please set a scheduled date.")
      return
    }

    setLoading(true)
    try {
      // If manual customer, create them first
      if (useManualCustomer) {
        const createCustomerRes = await fetch("/api/operations/job-management/create-customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: manualCustomerName.trim(),
            contact_number: manualCustomerPhone.trim(),
            email: manualCustomerEmail.trim(),
          }),
        })

        const createCustomerData = await createCustomerRes.json()
        if (!createCustomerRes.ok) {
          throw new Error(createCustomerData?.error ?? "Failed to create customer")
        }

        customerId = createCustomerData.customer_id
      }

      // Now create the job order
      const res = await fetch("/api/operations/job-management/add-job-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          service_id: selectedServiceId,
          vehicle_type_id: selectedVehicleTypeId,
          assigned_technician_id: null,
          plate_number: plateNumber.trim(),
          car_make: "",
          car_model: "",
          car_color: carColor.trim(),
          payment_amount: 0,
          scheduled_start: scheduledDate,
          scheduled_end:
            estimatedDays > 0
              ? addDays(scheduledDate, estimatedDays)
              : scheduledDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to create job order")

      setSuccess(true)
      setTimeout(() => router.push("/dashboard/job-management"), 1200)
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  const durationLabel = estimatedDays > 0
    ? `${estimatedDays} day${estimatedDays !== 1 ? "s" : ""}`
    : "—"
  const startDate = scheduledDate ? formatDate(scheduledDate) : "—"
  const expectedCompletion =
    scheduledDate && estimatedDays > 0
      ? addDays(scheduledDate, estimatedDays)
      : scheduledDate
      ? formatDate(scheduledDate)
      : "—"

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
          <p className="text-xs text-gray-400 mt-0.5">Enter customer and vehicle information.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Customer Section */}
          {!useManualCustomer ? (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Customer *</label>
                  {customers.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setUseManualCustomer(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Enter manually
                    </button>
                  )}
                </div>
                <select
                  value={selectedCustomerId ?? ""}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)
                    setError(null)
                  }}
                  disabled={loadingRefs}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">
                    {loadingRefs ? "Loading…" : customers.length === 0 ? "No customers found" : "— Select customer —"}
                  </option>
                  {customers.map((c) => (
                    <option key={c.customer_id} value={c.customer_id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Plate Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Plate Number *</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g., ABC-1234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">Customer Name *</label>
                  <button
                    type="button"
                    onClick={() => setUseManualCustomer(false)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select from list
                  </button>
                </div>
                <input
                  type="text"
                  value={manualCustomerName}
                  onChange={(e) => setManualCustomerName(e.target.value)}
                  placeholder="e.g., John Doe"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Plate Number *</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g., ABC-1234"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Phone Number *</label>
                <input
                  type="tel"
                  value={manualCustomerPhone}
                  onChange={(e) => setManualCustomerPhone(e.target.value)}
                  placeholder="e.g., +1-555-0123"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Email *</label>
                <input
                  type="email"
                  value={manualCustomerEmail}
                  onChange={(e) => setManualCustomerEmail(e.target.value)}
                  placeholder="e.g., john@example.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* Vehicle Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Vehicle Type *</label>
            <select
              value={selectedVehicleTypeId ?? ""}
              onChange={(e) => setSelectedVehicleTypeId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select type —</option>
              {vehicleTypes.map((v) => (
                <option key={v.vehicle_type_id} value={v.vehicle_type_id}>
                  {v.type_name}
                </option>
              ))}
            </select>
          </div>

          {/* Car Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Car Color *</label>
            <input
              type="text"
              value={carColor}
              onChange={(e) => setCarColor(e.target.value)}
              placeholder="e.g., Silver, Black"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Customer Info Summary */}
        {selectedCustomer && !useManualCustomer && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-blue-900">{selectedCustomer.full_name}</p>
            <p className="text-xs text-blue-700">📞 {selectedCustomer.contact_number}</p>
            <p className="text-xs text-blue-700">✉️ {selectedCustomer.email}</p>
          </div>
        )}
        {useManualCustomer && manualCustomerName && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-amber-900">{manualCustomerName}</p>
            <p className="text-xs text-amber-700">📞 {manualCustomerPhone || "—"}</p>
            <p className="text-xs text-amber-700">✉️ {manualCustomerEmail || "—"}</p>
          </div>
        )}
      </div>

      {/* Card 2: Service & Schedule */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-gray-800">Service & Schedule</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Service */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Service *</label>
            <select
              value={selectedServiceId ?? ""}
              onChange={(e) => {
                setSelectedServiceId(e.target.value ? Number(e.target.value) : null)
                setError(null)
              }}
              disabled={loadingRefs}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">
                {loadingRefs ? "Loading…" : services.length === 0 ? "No services found" : "— Select service —"}
              </option>
              {services.map((s) => (
                <option key={s.service_id} value={s.service_id}>
                  {s.service_name}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Scheduled Date *</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value)
                setError(null)
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Timeline Preview */}
        {scheduledDate && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Scheduled Start</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{startDate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Expected Completion</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{expectedCompletion}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{selectedService?.service_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Estimated Duration</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{durationLabel}</p>
              </div>
            </div>
          </div>
        )}
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
              loading || success
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gray-900 hover:bg-gray-800"
            }`}
          >
            {loading ? "Creating…" : success ? "Created!" : "Create Job Order"}
          </button>
        </div>
      </div>
    </div>
  )
}
