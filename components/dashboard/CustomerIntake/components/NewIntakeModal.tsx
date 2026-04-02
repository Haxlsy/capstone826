import { useState } from "react"
import { X } from "lucide-react"

export interface NewIntakeForm {
  customerName: string; contactNumber: string; email: string; address: string
  plate: string; make: string; model: string; color: string
  serviceType: string; downpayment: string; balance: string; paymentMethod: string
  scheduledDate: string
}

const emptyForm: NewIntakeForm = {
  customerName: "", contactNumber: "", email: "", address: "",
  plate: "", make: "", model: "", color: "",
  serviceType: "", downpayment: "", balance: "", paymentMethod: "",
  scheduledDate: "",
}

const PAYMENT_METHODS = ["Cash", "GCash", "Bank Transfer", "Credit Card"]

interface Props {
  onClose: () => void
  onSave: (f: NewIntakeForm) => void
  serviceTypes: string[]
}

export default function NewIntakeModal({ onClose, onSave, serviceTypes }: Props) {
  const [form, setForm] = useState<NewIntakeForm>(emptyForm)

  function set(key: keyof NewIntakeForm, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSave() {
    if (!form.customerName.trim() || !form.plate.trim() || !form.serviceType) return
    onSave(form)
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
              {([
                ["customerName", "Full Name"],
                ["contactNumber", "Contact Number"],
                ["email", "Email Address"],
                ["address", "Home Address"],
              ] as [keyof NewIntakeForm, string][]).map(([key, label]) => (
                <div key={key} className={key === "address" ? "col-span-2" : ""}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle Info */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Vehicle Information</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["plate", "Plate Number"],
                ["make", "Make"],
                ["model", "Model"],
                ["color", "Color"],
              ] as [keyof NewIntakeForm, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Service & Payment */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Service & Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Service Type</label>
                <select
                  value={form.serviceType}
                  onChange={(e) => set("serviceType", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                >
                  <option value="">Select service...</option>
                  {serviceTypes.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => set("scheduledDate", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Downpayment (₱)</label>
                <input
                  type="number"
                  value={form.downpayment}
                  onChange={(e) => set("downpayment", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Remaining Balance (₱)</label>
                <input
                  type="number"
                  value={form.balance}
                  onChange={(e) => set("balance", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>
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

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
            Save Intake
          </button>
        </div>
      </div>
    </div>
  )
}
