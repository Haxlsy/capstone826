"use client"

import { useState } from "react"
import { Pencil, X, Plus, Package, Clock, ChevronDown } from "lucide-react"

interface Service {
  id:                      string
  name:                    string
  description:             string | null
  estimated_duration_mins: number
}

interface Props {
  primaryService:    Service
  allServices:       Service[]
  packageServiceIds: string[]
  customName:        string
  customDurationMins: number | null
  onPackageChange:   (ids: string[]) => void
  onOverrideChange:  (name: string, duration: number | null) => void
}

function durationLabel(mins: number): string {
  if (mins <= 0) return "—"
  if (mins >= 60) {
    const h = Math.round(mins / 60)
    return `${h} hr${h !== 1 ? "s" : ""}`
  }
  return `${mins} min${mins !== 1 ? "s" : ""}`
}

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function ServiceOverridePanel({
  primaryService,
  allServices,
  packageServiceIds,
  customName,
  customDurationMins,
  onPackageChange,
  onOverrideChange,
}: Props) {
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [addOpen, setAddOpen]           = useState(false)
  const [addServiceId, setAddServiceId] = useState("")

  const isOverridden = customName !== primaryService.name || customDurationMins !== null

  const packageServices = allServices.filter((s) => packageServiceIds.includes(s.id))

  const availableToAdd = allServices.filter(
    (s) => s.id !== primaryService.id && !packageServiceIds.includes(s.id)
  )

  function toggleOverride() {
    if (overrideOpen) {
      // reset overrides when closing
      onOverrideChange(primaryService.name, null)
    }
    setOverrideOpen((v) => !v)
  }

  function addPackageService() {
    if (!addServiceId) return
    onPackageChange([...packageServiceIds, addServiceId])
    setAddServiceId("")
    setAddOpen(false)
  }

  function removePackageService(id: string) {
    onPackageChange(packageServiceIds.filter((i) => i !== id))
  }

  const displayDuration = customDurationMins ?? primaryService.estimated_duration_mins
  const totalDuration   = displayDuration + packageServices.reduce((sum, s) => sum + s.estimated_duration_mins, 0)

  return (
    <div className="w-80 shrink-0 flex flex-col gap-3">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Selected Service</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 leading-snug">
              {isOverridden && customName ? customName : primaryService.name}
              {isOverridden && <span className="ml-1.5 text-[10px] text-blue-500 font-medium">(overridden)</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleOverride}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium shrink-0 transition-colors ${
              overrideOpen
                ? "bg-blue-100 text-blue-600"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <Pencil className="w-3 h-3" />
            Override
          </button>
        </div>

        {/* Description */}
        {primaryService.description && (
          <p className="text-xs text-gray-500 leading-relaxed">{primaryService.description}</p>
        )}

        {/* Duration row */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            {durationLabel(displayDuration)}
            {customDurationMins !== null && (
              <span className="ml-1 text-blue-500">(overridden)</span>
            )}
          </span>
        </div>

        {/* Override fields */}
        {overrideOpen && (
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Override for this job only</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Service Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => onOverrideChange(e.target.value, customDurationMins)}
                className={INPUT_CLS}
                placeholder={primaryService.name}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Duration (minutes)</label>
              <input
                type="number"
                min={1}
                value={customDurationMins ?? primaryService.estimated_duration_mins}
                onChange={(e) => onOverrideChange(customName, Number(e.target.value) || null)}
                className={INPUT_CLS}
              />
            </div>
          </div>
        )}
      </div>

      {/* Package builder */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-600">Package Services</p>
            {packageServices.length > 0 && (
              <span className="bg-blue-100 text-blue-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {packageServices.length}
              </span>
            )}
          </div>
          {availableToAdd.length > 0 && (
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )}
        </div>

        {addOpen && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={addServiceId}
                onChange={(e) => setAddServiceId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-3 pr-7 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">— Select service —</option>
                {availableToAdd.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={addPackageService}
              disabled={!addServiceId}
              className="px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        )}

        {packageServices.length === 0 ? (
          <p className="text-xs text-gray-400">No additional services added.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {packageServices.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
                  <p className="text-[10px] text-gray-400">{durationLabel(s.estimated_duration_mins)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removePackageService(s.id)}
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Total duration */}
        {(packageServices.length > 0) && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
            <span className="text-gray-500">Total estimated duration</span>
            <span className="font-semibold text-gray-800">{durationLabel(totalDuration)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
