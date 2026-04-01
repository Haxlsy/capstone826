"use client"

import { useState } from "react"
import Link from "next/link"
import { Info } from "lucide-react"

interface IntakeRecord {
  id: string
  label: string
  customer: string
  contact: string
  email: string
  plate: string
  makeModel: string
  serviceType: string
}

const intakeRecords: IntakeRecord[] = [
  {
    id: "INT-001",
    label: "INT-001 · Maria Garcia · Engine Tune-Up",
    customer: "Maria Garcia",
    contact: "+63 912 345 6789",
    email: "maria.garcia@email.com",
    plate: "XYZ 5678",
    makeModel: "Honda City",
    serviceType: "Engine Tune-Up",
  },
  {
    id: "INT-002",
    label: "INT-002 · Patricia Lim · AC Repair",
    customer: "Patricia Lim",
    contact: "+63 917 876 5432",
    email: "patricia.lim@email.com",
    plate: "MNO 1234",
    makeModel: "Toyota Vios",
    serviceType: "AC Repair",
  },
  {
    id: "INT-003",
    label: "INT-003 · Isabelle Navarro · Brake Replacement",
    customer: "Isabelle Navarro",
    contact: "+63 998 112 3344",
    email: "isabelle.navarro@email.com",
    plate: "YZA 7890",
    makeModel: "Mitsubishi Mirage",
    serviceType: "Brake Replacement",
  },
]

const technicians = ["Mark Santos", "Pedro Lim", "Rosa Aquino", "David Cruz"]

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function addDays(dateStr: string, days: number): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function AddJobOrderForm() {
  const [selectedIntakeId, setSelectedIntakeId] = useState("")
  const [selectedTechnician, setSelectedTechnician] = useState("")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")

  const selectedIntake = intakeRecords.find((r) => r.id === selectedIntakeId) ?? null
  const hasIntake = selectedIntake !== null
  const hasDate = scheduledDate !== ""

  const serviceType = hasIntake ? selectedIntake.serviceType : "—"
  const estimatedDuration = hasIntake ? "3 days" : "—"
  const startDate = hasIntake && hasDate ? formatDate(scheduledDate) : "—"
  const expectedCompletion = hasIntake && hasDate ? addDays(scheduledDate, 3) : "—"

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400">
        <span>Job Management</span>
        <span className="mx-1.5">›</span>
        <span className="text-gray-600">Add Job Order</span>
      </div>

      {/* Page title */}
      <h1 className="text-xl font-bold text-gray-800">Create New Job Order</h1>

      {/* Card 1: Customer Intake Reference */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm text-gray-800">Customer Intake Reference</h2>
          <p className="text-xs text-gray-400 mt-0.5">Pre-filled from a Sales-submitted intake record.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Select Customer Intake Record</label>
          <select
            value={selectedIntakeId}
            onChange={(e) => setSelectedIntakeId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">— Select an intake record —</option>
            {intakeRecords.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {!hasIntake ? (
          <div className="text-center py-6 text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
            Select an intake record above to view customer and vehicle details.
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <div>
                <p className="text-xs text-gray-400">Customer Name</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.customer}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Vehicle Plate</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.plate}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Contact</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.contact}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Make / Model</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.makeModel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Email</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Service Type</p>
                <p className="text-sm text-gray-700 mt-0.5">{selectedIntake.serviceType}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card 2: Job Assignment */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-sm text-gray-800">Job Assignment</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Assigned Technician</label>
            <select
              value={selectedTechnician}
              onChange={(e) => setSelectedTechnician(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">— Select technician —</option>
              {technicians.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Card 3: Auto-Generated Timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm text-gray-800">Auto-Generated Timeline</h2>
          <Info className="w-4 h-4 text-gray-400" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">Service Type</p>
            <p className="text-sm text-gray-700">{serviceType}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">Estimated Duration</p>
            <p className="text-sm text-gray-700">{estimatedDuration}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">Start Date</p>
            <p className="text-sm text-gray-700">{startDate}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xs text-gray-400">Expected Completion Date</p>
            <p className="text-sm text-gray-700">{expectedCompletion}</p>
          </div>
        </div>

        <p className="text-xs text-blue-500 italic">
          The job timeline is automatically generated based on the service duration defined by the Admin. This cannot be modified.
        </p>
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3">
        <Link
          href="/dashboard/job-management"
          className="flex-1 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl text-center hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
        <button className="flex-1 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors">
          Create Job Order
        </button>
      </div>
    </div>
  )
}
