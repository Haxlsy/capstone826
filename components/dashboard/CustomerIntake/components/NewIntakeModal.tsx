import { useState, useEffect } from "react"
import { X } from "lucide-react"

export interface NewIntakeForm {
  customerName: string; contactNumber: string; email: string; address: string
  plate: string; vehicleTypeId: string; make: string; model: string; color: string
  serviceType: string; downpayment: string; balance: string; paymentMethod: string
  scheduledDate: string
}

const emptyForm: NewIntakeForm = {
  customerName: "", contactNumber: "", email: "", address: "",
  plate: "", vehicleTypeId: "", make: "", model: "", color: "",
  serviceType: "", downpayment: "", balance: "", paymentMethod: "",
  scheduledDate: "",
}

const PAYMENT_METHODS = ["Cash", "GCash", "Bank Transfer", "Credit Card"]

type FormErrors = Partial<Record<keyof NewIntakeForm | "_save", string>>

function isValidPHNumber(raw: string): boolean {
  const n = raw.replace(/[-\s]/g, "")
  return /^(09\d{9}|\+639\d{9})$/.test(n)
}

interface Props {
  onClose: () => void
  onSave: (f: NewIntakeForm) => Promise<string | null>
  serviceTypes: string[]
}

export default function NewIntakeModal({ onClose, onSave, serviceTypes }: Props) {
  const [form, setForm] = useState<NewIntakeForm>(emptyForm)
  const [vehicleTypes, setVehicleTypes] = useState<{ vehicle_type_id: number; type_name: string }[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/operations/job-management/list-vehicle-types")
      .then((r) => r.json())
      .then((j) => setVehicleTypes(j.vehicle_types ?? []))
      .catch(() => {})
  }, [])

  function set(key: keyof NewIntakeForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setErrors((prev) => { const e = { ...prev }; delete e[key]; delete e._save; return e })
  }

  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.customerName.trim()) e.customerName = "Full name is required."
    if (!form.contactNumber.trim()) {
      e.contactNumber = "Contact number is required."
    } else if (!isValidPHNumber(form.contactNumber)) {
      e.contactNumber = "Enter a valid PH mobile number (e.g. 09171234567)."
    }
    if (!form.plate.trim()) e.plate = "Plate number is required."
    if (!form.serviceType) e.serviceType = "Service type is required."
    if (form.downpayment && isNaN(Number(form.downpayment))) e.downpayment = "Must be a valid number."
    if (form.balance && isNaN(Number(form.balance))) e.balance = "Must be a valid number."
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const errMsg = await onSave(form)
    setSaving(false)
    if (errMsg) setErrors({ _save: errMsg })
  }

  function field(key: keyof NewIntakeForm, label: string, type = "text", className = "") {
    return (
      <div key={key} className={className}>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label}
          {["customerName","contactNumber","plate","serviceType"].includes(key) && (
            <span className="text-red-400 ml-0.5">*</span>
          )}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          className={`w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${errors[key] ? "border-red-400 focus:ring-red-300" : "border-gray-200 focus:ring-blue-400"}`}
        />
        {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-800">New Customer Intake</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Customer Details */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Customer Details</p>
            <div className="grid grid-cols-2 gap-3">
              {field("customerName", "Full Name")}
              {field("contactNumber", "Contact Number")}
              {field("email", "Email Address")}
              {field("address", "Home Address", "text", "col-span-2")}
            </div>
          </div>

          {/* Vehicle Info */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Vehicle Information</p>
            <div className="grid grid-cols-2 gap-3">
              {field("plate", "Plate Number")}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Vehicle Type</label>
                <select
                  value={form.vehicleTypeId}
                  onChange={(e) => set("vehicleTypeId", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                >
                  <option value="">Select type...</option>
                  {vehicleTypes.map((t) => <option key={t.vehicle_type_id} value={t.vehicle_type_id}>{t.type_name}</option>)}
                </select>
              </div>
              {field("make", "Make")}
              {field("model", "Model")}
              {field("color", "Color")}
            </div>
          </div>

          {/* Service & Payment */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Service & Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Service Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.serviceType}
                  onChange={(e) => set("serviceType", e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 transition ${errors.serviceType ? "border-red-400 focus:ring-red-300" : "border-gray-200 focus:ring-blue-400"}`}
                >
                  <option value="">Select service...</option>
                  {serviceTypes.map((s) => <option key={s}>{s}</option>)}
                </select>
                {errors.serviceType && <p className="text-xs text-red-500 mt-1">{errors.serviceType}</p>}
              </div>
              {field("scheduledDate", "Scheduled Date", "date")}
              {field("downpayment", "Downpayment (₱)", "number")}
              {field("balance", "Remaining Balance (₱)", "number")}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => set("paymentMethod", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                >
                  <option value="">Select method...</option>
                  {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {errors._save && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors._save}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save Intake"}
          </button>
        </div>
      </div>
    </div>
  )
}
