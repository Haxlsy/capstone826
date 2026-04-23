"use client"

import { User, Wrench, Calendar, Users, X } from "lucide-react"

export interface JobOrderSummary {
  // Customer
  customerName:  string
  contactNumber: string
  email:         string | null
  plateNumber:   string
  vehicleUnit:   string

  // Service
  serviceName:  string
  isOverridden: boolean
  stages:       Array<{ name: string; category: "preparation" | "installation" | "finishing" }>

  // Schedule
  scheduledAt: string
  expectedEnd: string
  duration:    string

  // Team
  headDetailer:  string
  headInstaller: string
  detailers:     string[]
  installers:    string[]
}

interface Props {
  summary:    JobOrderSummary
  submitting: boolean
  onConfirm:  () => void
  onBack:     () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 shrink-0">{label}</span>
      <span className="text-xs font-medium text-gray-700 text-right">{value || "—"}</span>
    </div>
  )
}

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      </div>
      {children}
    </div>
  )
}

function categoryClass(cat: "preparation" | "installation" | "finishing") {
  if (cat === "preparation") return "bg-blue-50 text-blue-600"
  if (cat === "installation") return "bg-amber-50 text-amber-600"
  return "bg-emerald-50 text-emerald-600"
}

function categoryLabel(cat: "preparation" | "installation" | "finishing") {
  if (cat === "preparation") return "Prep"
  if (cat === "installation") return "Install"
  return "Finish"
}

export default function JobOrderConfirmDialog({ summary, submitting, onConfirm, onBack }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Confirm Job Order</h2>
            <p className="text-xs text-gray-400 mt-0.5">Review details before creating.</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 flex flex-col gap-3">
          {/* Customer */}
          <Section icon={User} title="Customer & Vehicle">
            <Row label="Name"    value={summary.customerName} />
            <Row label="Contact" value={summary.contactNumber} />
            {summary.email && <Row label="Email" value={summary.email} />}
            <Row label="Plate"   value={summary.plateNumber} />
            <Row label="Vehicle" value={summary.vehicleUnit} />
          </Section>

          {/* Service */}
          <Section icon={Wrench} title="Service">
            <Row
              label="Service"
              value={summary.serviceName + (summary.isOverridden ? " (overridden)" : "")}
            />
            {summary.stages.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                  Workflow Stages
                </p>
                {summary.stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-4 shrink-0">{i + 1}.</span>
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${categoryClass(s.category)}`}
                    >
                      {categoryLabel(s.category)}
                    </span>
                    <span className="text-xs text-gray-700">{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Schedule */}
          <Section icon={Calendar} title="Schedule">
            <Row label="Scheduled"           value={summary.scheduledAt} />
            <Row label="Expected Completion" value={summary.expectedEnd} />
            <Row label="Est. Duration"       value={summary.duration} />
          </Section>

          {/* Team */}
          <Section icon={Users} title="Team">
            <Row label="Head Detailer"  value={summary.headDetailer} />
            <Row label="Head Installer" value={summary.headInstaller} />
            <Row label="Detailers"      value={summary.detailers.join(", ")} />
            <Row label="Installers"     value={summary.installers.join(", ")} />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Back to Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex-1 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Creating…" : "Confirm & Create"}
          </button>
        </div>
      </div>
    </div>
  )
}
