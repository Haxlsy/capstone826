"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import ServiceOverridePanel, { type Stage } from "./ServiceOverridePanel"
import JobOrderConfirmDialog, { type JobOrderSummary } from "./JobOrderConfirmDialog"

interface CustomerRecord {
  id:             string
  full_name:      string
  contact_number: string
  email:          string | null
  plate_number:   string
  vehicle_unit:   string | null
  has_active_job: boolean
}

interface Service {
  id:                      string
  name:                    string
  service_type:            string | null
  description:             string | null
  estimated_duration_mins: number
}

interface HeadTech {
  id:          string
  full_name:   string
  role:        "head_detailer" | "head_installer"
  active_jobs: number
}

interface CrewMember {
  id:             string
  full_name:      string
  role:           "detailer" | "installer"
  is_available:   boolean
  on_job:         boolean
  available_days: string[]
}

interface FieldErrors {
  customer?:      string
  customerName?:  string
  contactNumber?: string
  plateNumber?:   string
  vehicleUnit?:   string
  service?:       string
  scheduledAt?:   string
  headDetailer?:  string
  headInstaller?: string
  detailers?:     string
  installers?:    string
}

function inputCls(hasError?: boolean, locked?: boolean) {
  if (locked) return "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-100 cursor-not-allowed focus:outline-none"
  return `w-full border ${hasError ? "border-red-400 focus:ring-red-500 bg-red-50/30" : "border-gray-300 focus:ring-blue-500 bg-white"} rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2`
}

function selectCls(hasError?: boolean) {
  return `${inputCls(hasError)} disabled:opacity-50`
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-1">{msg}</p>
}

function CrewCheckboxList({
  label,
  members,
  selected,
  onToggle,
  loading,
  required,
  error,
}: {
  label:     string
  members:   CrewMember[]
  selected:  Set<string>
  onToggle:  (id: string) => void
  loading:   boolean
  required?: boolean
  error?:    string
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
        <p className="text-xs text-gray-400 py-2">No available {label.toLowerCase()} at the moment.</p>
      ) : (
        <div className={`border rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto ${error ? "border-red-400 bg-red-50/20" : "border-gray-200"}`}>
          {members.map((c) => {
            const disabled = c.on_job || !c.is_available
            return (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2.5 ${disabled ? "bg-gray-50/60 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => !disabled && onToggle(c.id)}
                  disabled={disabled}
                  className="w-4 h-4 rounded border-gray-300 disabled:opacity-40"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${disabled ? "text-gray-400" : "text-gray-700"}`}>{c.full_name}</p>
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  c.on_job
                    ? "bg-orange-100 text-orange-600"
                    : c.is_available
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-400"
                }`}>
                  {c.on_job ? "On Job" : c.is_available ? "Available" : "Unavailable"}
                </span>
              </label>
            )
          })}
        </div>
      )}
      <FieldError msg={error} />
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
  const [manualEmail,          setManualEmail]          = useState("")
  const [manualPlateNumber,    setManualPlateNumber]    = useState("")
  const [manualVehicleUnit,    setManualVehicleUnit]    = useState("")
  const [matchedPlateCustomer, setMatchedPlateCustomer] = useState<CustomerRecord | null>(null)

  const [selectedServiceType,     setSelectedServiceType]     = useState<string | null>(null)
  const [selectedServiceId,       setSelectedServiceId]       = useState<string | null>(null)
  const [customServiceName,       setCustomServiceName]       = useState("")
  const [customDescription,       setCustomDescription]       = useState("")
  const [customDurationMins,      setCustomDurationMins]      = useState<number | null>(null)
  const [originalStages,          setOriginalStages]          = useState<Stage[]>([])
  const [customStages,            setCustomStages]            = useState<Stage[]>([])
  const [stagesLoading,           setStagesLoading]           = useState(false)
  const [selectedHeadDetailerId,  setSelectedHeadDetailerId]  = useState<string | null>(null)
  const [selectedHeadInstallerId, setSelectedHeadInstallerId] = useState<string | null>(null)
  const [selectedDetailerIds,     setSelectedDetailerIds]     = useState<Set<string>>(new Set())
  const [selectedInstallerIds,    setSelectedInstallerIds]    = useState<Set<string>>(new Set())
  const [scheduledAt,             setScheduledAt] = useState("")

  const [loading,        setLoading]        = useState(false)
  const [fieldErrors,    setFieldErrors]    = useState<FieldErrors>({})
  const [apiError,       setApiError]       = useState<string | null>(null)
  const [success,        setSuccess]        = useState(false)
  const [showConfirm,    setShowConfirm]    = useState(false)
  const [confirmSummary, setConfirmSummary] = useState<JobOrderSummary | null>(null)

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
        setApiError("Failed to load form data. Please refresh.")
      } finally {
        setLoadingRefs(false)
      }
    }
    loadRefs()
  }, [])

  useEffect(() => {
    if (!useManualCustomer) return
    const plate = manualPlateNumber.trim().toLowerCase()
    if (!plate) { setMatchedPlateCustomer(null); return }
    const match = customers.find((c) => c.plate_number.toLowerCase() === plate)
    if (match) {
      setMatchedPlateCustomer(match)
      setManualCustomerName(match.full_name)
      setManualContactNumber(match.contact_number)
      setManualEmail(match.email ?? "")
      setManualVehicleUnit(match.vehicle_unit ?? "")
    } else {
      setMatchedPlateCustomer(null)
    }
  }, [manualPlateNumber, customers, useManualCustomer])

  function clearField(key: keyof FieldErrors) {
    setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  async function fetchStages(serviceId: string) {
    setStagesLoading(true)
    try {
      const res  = await fetch(`/api/operations/job-management/service-stages?serviceId=${serviceId}`)
      const json = await res.json()
      const stages: Stage[] = json.stages ?? []
      setOriginalStages(stages)
      setCustomStages(stages)
    } catch {
      // non-fatal — panel will show empty stage list
    } finally {
      setStagesLoading(false)
    }
  }

  const selectedCustomer = !useManualCustomer
    ? customers.find((c) => c.id === selectedCustomerId) ?? null
    : null

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null

  const uniqueServiceTypes = useMemo(
    () => [...new Set(services.map((s) => s.service_type).filter(Boolean))] as string[],
    [services]
  )

  const availableServices = useMemo(
    () => (selectedServiceType ? services.filter((s) => s.service_type === selectedServiceType) : []),
    [selectedServiceType, services]
  )

  function handleServiceTypeChange(type: string | null) {
    setSelectedServiceType(type)
    setSelectedServiceId(null)
    setCustomServiceName("")
    setCustomDescription("")
    setCustomDurationMins(null)
    setOriginalStages([])
    setCustomStages([])
    clearField("service")
  }

  function handleServiceClear() {
    setSelectedServiceId(null)
    setCustomDescription("")
    setCustomDurationMins(null)
    setOriginalStages([])
    setCustomStages([])
  }

  function handleServiceSelect(svc: Service) {
    setSelectedServiceId(svc.id)
    setCustomServiceName(svc.name)
    setCustomDescription(svc.description ?? "")
    setCustomDurationMins(null)
    setOriginalStages([])
    setCustomStages([])
    fetchStages(svc.id)
  }

  function handleResetOverrides() {
    if (!selectedService) return
    setCustomServiceName(selectedService.name)
    setCustomDescription(selectedService.description ?? "")
    setCustomDurationMins(null)
    setCustomStages(originalStages)
  }

  const PHONE_RE = /^(09|\+639)\d{9}$/

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!useManualCustomer && !selectedCustomerId)
      errs.customer = "Please select a customer."
    if (useManualCustomer) {
      if (!manualCustomerName.trim())
        errs.customerName = "Customer name is required."
      const rawPhone = manualContactNumber.replace(/[\s\-]/g, "")
      if (!rawPhone)
        errs.contactNumber = "Contact number is required."
      else if (!PHONE_RE.test(rawPhone))
        errs.contactNumber = "Must be a valid PH mobile number (e.g., 09XX-XXX-XXXX)."
      if (!manualPlateNumber.trim())
        errs.plateNumber = "Plate number is required."
      if (!manualVehicleUnit.trim())
        errs.vehicleUnit = "Vehicle unit is required."
    }
    if (!selectedServiceType) {
      errs.service = "Please select a service type."
    } else if (!selectedServiceId) {
      errs.service = "Please select a service name from the panel."
    }
    if (!scheduledAt) {
      errs.scheduledAt = isPPF
        ? "Please set a scheduled date."
        : "Please set a scheduled date and time."
    } else {
      const now = new Date()
      if (isPPF) {
        if (scheduledAt < todayStr) {
          errs.scheduledAt = "Scheduled date cannot be in the past."
        }
      } else {
        const selected = new Date(scheduledAt)
        if (selected <= now) {
          errs.scheduledAt = "Scheduled date and time cannot be in the past."
        } else {
          const totalMins = selected.getHours() * 60 + selected.getMinutes()
          if (totalMins < 8 * 60 || totalMins > 20 * 60) {
            errs.scheduledAt = "Start time must be within working hours (8:00 AM – 8:00 PM)."
          }
        }
      }
    }
    if (!selectedHeadDetailerId)         errs.headDetailer  = "Please select a Head Detailer."
    if (!selectedHeadInstallerId)        errs.headInstaller = "Please select a Head Installer."
    if (selectedDetailerIds.size === 0)  errs.detailers     = "Please assign at least one Detailer."
    if (selectedInstallerIds.size === 0) errs.installers    = "Please assign at least one Installer."
    return errs
  }

  const headDetailers  = headTechs.filter((t) => t.role === "head_detailer")
  const headInstallers = headTechs.filter((t) => t.role === "head_installer")

  function toggleCrew(id: string, set: Set<string>, setter: (s: Set<string>) => void, field: keyof FieldErrors) {
    const member = crewMembers.find((c) => c.id === id)
    if (member?.on_job) return
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
    if (next.size > 0) clearField(field)
  }

  const isPPF    = selectedServiceType === "Paint Protection Film"
  const todayStr = new Date().toISOString().split("T")[0]

  // Day-of-week label derived from scheduled date — used to filter crew by available_days
  const scheduledDayLabel: string | null = useMemo(() => {
    if (!scheduledAt) return null
    const d = isPPF
      ? (() => { const [y, mo, dd] = scheduledAt.split("-").map(Number); return new Date(y, mo - 1, dd) })()
      : new Date(scheduledAt)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]
  }, [scheduledAt, isPPF])

  const detailers = crewMembers.filter((c) =>
    c.role === "detailer" &&
    !c.on_job &&
    c.is_available &&
    (!scheduledDayLabel || (c.available_days ?? []).includes(scheduledDayLabel))
  )
  const installers = crewMembers.filter((c) =>
    c.role === "installer" &&
    !c.on_job &&
    c.is_available &&
    (!scheduledDayLabel || (c.available_days ?? []).includes(scheduledDayLabel))
  )

  // Resolve a full ISO datetime from scheduledAt regardless of whether it's
  // a date-only string (PPF) or a full datetime string (other services).
  function resolveStartDate(raw: string, ppf: boolean): Date {
    if (ppf) {
      const [y, m, d] = raw.split("-").map(Number)
      return new Date(y, m - 1, d, 8, 0, 0)
    }
    return new Date(raw)
  }

  function formatScheduledStart(raw: string, ppf: boolean): string {
    if (!raw) return "—"
    const d = resolveStartDate(raw, ppf)
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  }

  // Calculates expected completion respecting working hours (8 AM – 8 PM).
  // If a day's remaining work time is exhausted, the job continues the next
  // calendar day starting at 8 AM.
  function calculateCompletion(raw: string, durationMins: number, ppf: boolean): string {
    if (!raw || durationMins <= 0) return "—"
    const WORK_START = 8 * 60    // 480  mins
    const WORK_END   = 20 * 60   // 1200 mins

    let current   = resolveStartDate(raw, ppf)
    let remaining = durationMins

    while (remaining > 0) {
      const nowMins      = current.getHours() * 60 + current.getMinutes()
      const availToday   = WORK_END - nowMins

      if (availToday <= 0) {
        // Already at or past 8 PM — jump to next day at 8 AM
        current.setDate(current.getDate() + 1)
        current.setHours(WORK_START / 60, 0, 0, 0)
        continue
      }

      if (remaining <= availToday) {
        current = new Date(current.getTime() + remaining * 60_000)
        remaining = 0
      } else {
        remaining -= availToday
        current.setDate(current.getDate() + 1)
        current.setHours(WORK_START / 60, 0, 0, 0)
      }
    }

    return current.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    })
  }

  function handleConfirmClick() {
    setApiError(null)
    const errs = validate()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setFieldErrors({})

    const effDuration = customDurationMins ?? (selectedService?.estimated_duration_mins ?? 0)
    const dLabel = effDuration <= 0 ? "—"
      : effDuration >= 60
        ? `${Math.round(effDuration / 60)} hr${Math.round(effDuration / 60) !== 1 ? "s" : ""}`
        : `${effDuration} min${effDuration !== 1 ? "s" : ""}`

    const summary: JobOrderSummary = {
      customerName:  selectedCustomer?.full_name    ?? manualCustomerName.trim(),
      contactNumber: selectedCustomer?.contact_number ?? manualContactNumber.trim(),
      email:         selectedCustomer?.email          ?? (manualEmail.trim() || null),
      plateNumber:   selectedCustomer?.plate_number   ?? manualPlateNumber.trim(),
      vehicleUnit:   selectedCustomer?.vehicle_unit   ?? manualVehicleUnit.trim(),
      serviceName:   customServiceName || selectedService?.name || "—",
      isOverridden:  !!customServiceName && customServiceName !== selectedService?.name,
      stages:        customStages.map((s) => ({ name: s.name, category_name: s.category_name, category_color: s.category_color })),
      scheduledAt:   formatScheduledStart(scheduledAt, isPPF),
      expectedEnd:   scheduledAt && effDuration > 0
        ? calculateCompletion(scheduledAt, effDuration, isPPF)
        : formatScheduledStart(scheduledAt, isPPF),
      duration:      dLabel,
      headDetailer:  headTechs.find((t) => t.id === selectedHeadDetailerId)?.full_name  ?? "—",
      headInstaller: headTechs.find((t) => t.id === selectedHeadInstallerId)?.full_name ?? "—",
      detailers:     crewMembers.filter((c) => selectedDetailerIds.has(c.id)).map((c) => c.full_name),
      installers:    crewMembers.filter((c) => selectedInstallerIds.has(c.id)).map((c) => c.full_name),
    }
    setConfirmSummary(summary)
    setShowConfirm(true)
  }

  async function submitOrder() {
    setLoading(true)
    setApiError(null)
    try {
      // Determine which overrides actually changed
      const nameChanged = customServiceName !== (selectedService?.name ?? "")
      const descChanged = customDescription !== (selectedService?.description ?? "")

      // Send all stages — the API distinguishes new vs. existing via is_new
      const customStagesPayload = customStages.length > 0
        ? customStages.map((s, i) => ({
            service_stage_id:      s.isNew ? null : s.id,
            is_new:                s.isNew ?? false,
            custom_name:           s.name,
            custom_stage_category: s.isNew ? (s.category_name ?? null) : null,
            custom_sequence_order: i + 1,
            stage_duration_mins:   s.stage_duration_mins ?? 0,
          }))
        : null

      const payload: Record<string, unknown> = {
        service_id:           selectedServiceId,
        scheduled_at:         isPPF
          ? new Date(`${scheduledAt}T08:00:00`).toISOString()
          : new Date(scheduledAt).toISOString(),
        head_detailer_id:     selectedHeadDetailerId  ?? null,
        head_installer_id:    selectedHeadInstallerId ?? null,
        detailer_ids:         [...selectedDetailerIds],
        installer_ids:        [...selectedInstallerIds],
        custom_service_name:  nameChanged ? customServiceName : null,
        custom_description:   descChanged ? customDescription : null,
        custom_duration_mins: customDurationMins,
        custom_stages:        customStagesPayload,
      }

      if (!useManualCustomer) {
        payload.customer_record_id = selectedCustomerId
      } else {
        payload.customer_name  = manualCustomerName.trim()
        payload.contact_number = manualContactNumber.trim()
        payload.email          = manualEmail.trim() || null
        payload.plate_number   = manualPlateNumber.trim()
        payload.vehicle_unit   = manualVehicleUnit.trim() || null
      }

      const res  = await fetch("/api/operations/job-management/add-job-order", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to create job order")
      setShowConfirm(false)
      setSuccess(true)
      redirectTimer.current = setTimeout(() => router.push("/dashboard/job-management"), 1200)
    } catch (err: unknown) {
      setShowConfirm(false)
      setApiError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const estimatedMins  = customDurationMins ?? (selectedService?.estimated_duration_mins ?? 0)
  const hrs            = Math.round(estimatedMins / 60)
  const durationLabel  = estimatedMins > 0
    ? estimatedMins >= 60
      ? `${hrs} hr${hrs !== 1 ? "s" : ""}`
      : `${estimatedMins} min${estimatedMins !== 1 ? "s" : ""}`
    : "—"
  const effectiveServiceName = customServiceName || selectedService?.name || "—"
  const expectedCompletion   = scheduledAt && estimatedMins > 0
    ? calculateCompletion(scheduledAt, estimatedMins, isPPF)
    : scheduledAt ? formatScheduledStart(scheduledAt, isPPF) : "—"

  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    if(!searchQuery.trim()) return customers;
    return customers.filter((c)=>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.plate_number.toLowerCase().includes(searchQuery.toLowerCase())
    )
  },[searchQuery, customers]);

  return (
    <>
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* ── Page header (full width, above both columns) ─────────── */}
      <div>
        <div className="text-xs text-gray-400 mb-1">
          <span>Job Order</span>
          <span className="mx-1.5">›</span>
          <span className="text-gray-600">Add Job Order</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Create New Job Order</h1>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Job order created! Redirecting…
        </div>
      )}

      {/* ── Two-column: form cards + panel ───────────────────────── */}
      <div className="flex gap-6 items-start">
      {/* ── Left: form ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 flex-1 min-w-0">
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
                    onClick={() => { setUseManualCustomer(true); setSelectedCustomerId(null); setFieldErrors({}); setMatchedPlateCustomer(null); setManualPlateNumber(""); setManualCustomerName(""); setManualContactNumber(""); setManualEmail(""); setManualVehicleUnit("") }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Enter manually
                  </button>
                </div>
                <div className="relative group">
                <input
                  type="text"
                  placeholder="Search name or plate..."
                  value={searchQuery}
                  onFocus={() => setIsOpen(true)}
                  // Using a blur with delay so the click on the item actually registers
                  onBlur={() => setTimeout(() => setIsOpen(false), 200)}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearchQuery(e.target.value);
                    setIsOpen(true);

                    if(value === ""){
                      setSelectedCustomerId(null);
                    }
                  }}
                  className={selectCls(!!fieldErrors.customer)}
                />
                
                {/* Search Results Dropdown with Scrollbar */}
                {isOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={c.has_active_job}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors border-b last:border-none border-gray-50 flex flex-col ${
                              c.has_active_job
                                ? "opacity-50 cursor-not-allowed bg-gray-50"
                                : "hover:bg-emerald-50 cursor-pointer"
                            }`}
                            onClick={() => {
                              if (c.has_active_job) return;
                              setSelectedCustomerId(c.id);
                              setSearchQuery(c.full_name);
                              setIsOpen(false);
                            }}
                          >
                            <span className="font-semibold text-gray-900 flex items-center gap-2">
                              {c.full_name}
                              {c.has_active_job && (
                                <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                  Being Serviced
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{c.plate_number}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-gray-400">
                          No matching customers
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
                <FieldError msg={fieldErrors.customer} />
              </div>

              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-blue-900">{selectedCustomer.full_name}</p>
                  <p className="text-xs text-blue-700">📞 {selectedCustomer.contact_number}</p>
                  <p className="text-xs text-blue-700">✉️ {selectedCustomer.email ?? "—"}</p>
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
                    onClick={() => { setUseManualCustomer(false); setFieldErrors({}); setMatchedPlateCustomer(null) }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Select from records
                  </button>
                </div>
                <input
                  type="text"
                  value={manualCustomerName}
                  readOnly={!!matchedPlateCustomer}
                  onChange={(e) => { if (!matchedPlateCustomer) { setManualCustomerName(e.target.value); clearField("customerName") } }}
                  placeholder="e.g., Juan dela Cruz"
                  className={inputCls(!!fieldErrors.customerName, !!matchedPlateCustomer)}
                />
                <FieldError msg={fieldErrors.customerName} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Contact Number <span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="tel"
                  value={manualContactNumber}
                  readOnly={!!matchedPlateCustomer}
                  onChange={(e) => { if (!matchedPlateCustomer) { setManualContactNumber(e.target.value); clearField("contactNumber") } }}
                  placeholder="e.g., 09XX-XXX-XXXX"
                  className={inputCls(!!fieldErrors.contactNumber, !!matchedPlateCustomer)}
                />
                <FieldError msg={fieldErrors.contactNumber} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Plate Number <span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="text"
                  value={manualPlateNumber}
                  onChange={(e) => { setManualPlateNumber(e.target.value); clearField("plateNumber") }}
                  placeholder="e.g., ABC-1234"
                  className={inputCls(!!fieldErrors.plateNumber)}
                />
                {matchedPlateCustomer && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-0.5">
                    Existing record found — customer info auto-filled and locked.
                  </p>
                )}
                <FieldError msg={fieldErrors.plateNumber} />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  value={manualEmail}
                  readOnly={!!matchedPlateCustomer}
                  onChange={(e) => { if (!matchedPlateCustomer) setManualEmail(e.target.value) }}
                  placeholder="e.g., juan@email.com"
                  className={inputCls(false, !!matchedPlateCustomer)}
                />
              </div>
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs font-medium text-gray-600">Vehicle Unit <span className="text-red-500 ml-0.5">*</span></label>
                <input
                  type="text"
                  value={manualVehicleUnit}
                  readOnly={!!matchedPlateCustomer}
                  onChange={(e) => { if (!matchedPlateCustomer) { setManualVehicleUnit(e.target.value); clearField("vehicleUnit") } }}
                  placeholder="e.g., Toyota Vios 2020"
                  className={inputCls(!!fieldErrors.vehicleUnit, !!matchedPlateCustomer)}
                />
                <FieldError msg={fieldErrors.vehicleUnit} />
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Service & Schedule */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-sm text-gray-800">Service & Schedule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Service <span className="text-red-500 ml-0.5">*</span></label>
              <select
                value={selectedServiceType ?? ""}
                onChange={(e) => handleServiceTypeChange(e.target.value || null)}
                disabled={loadingRefs}
                aria-label="Service Type"
                className={selectCls(!!fieldErrors.service)}
              >
                <option value="">{loadingRefs ? "Loading…" : services.length === 0 ? "No services found" : "— Select service type —"}</option>
                {uniqueServiceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <FieldError msg={fieldErrors.service} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">
                {isPPF ? "Scheduled Date" : "Scheduled Date & Time"}
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              {isPPF ? (
                <input
                  aria-label="Scheduled Date"
                  type="date"
                  min={todayStr}
                  value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); clearField("scheduledAt"); setSelectedDetailerIds(new Set()); setSelectedInstallerIds(new Set()) }}
                  className={inputCls(!!fieldErrors.scheduledAt)}
                />
              ) : (
                <input
                  aria-label="Scheduled Date and Time"
                  type="datetime-local"
                  min={`${todayStr}T08:00`}
                  value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); clearField("scheduledAt"); setSelectedDetailerIds(new Set()); setSelectedInstallerIds(new Set()) }}
                  className={inputCls(!!fieldErrors.scheduledAt)}
                />
              )}
              {!fieldErrors.scheduledAt && !isPPF && (
                <p className="text-[10px] text-gray-400">Working hours: 8:00 AM – 8:00 PM</p>
              )}
              <FieldError msg={fieldErrors.scheduledAt} />
            </div>
          </div>

          {scheduledAt && (
            <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Scheduled Start</p>
                <p className="text-sm font-medium text-gray-800 mt-1">
                  {formatScheduledStart(scheduledAt, isPPF)}
                </p>
                {isPPF && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Starts at 8:00 AM</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Expected Completion</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{expectedCompletion}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="text-sm font-medium text-gray-800 mt-1">{effectiveServiceName}</p>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Head Detailer <span className="text-red-500">*</span></label>
              <select
                value={selectedHeadDetailerId ?? ""}
                onChange={(e) => { setSelectedHeadDetailerId(e.target.value || null); clearField("headDetailer") }}
                disabled={loadingRefs}
                aria-label="Head Detailer"
                className={selectCls(!!fieldErrors.headDetailer)}
              >
                <option value="">— Select head detailer —</option>
                {headDetailers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}{t.active_jobs > 0 ? ` (${t.active_jobs} active)` : ""}
                  </option>
                ))}
              </select>
              <FieldError msg={fieldErrors.headDetailer} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">Head Installer <span className="text-red-500">*</span></label>
              <select
                value={selectedHeadInstallerId ?? ""}
                onChange={(e) => { setSelectedHeadInstallerId(e.target.value || null); clearField("headInstaller") }}
                disabled={loadingRefs}
                aria-label="Head Installer"
                className={selectCls(!!fieldErrors.headInstaller)}
              >
                <option value="">— Select head installer —</option>
                {headInstallers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}{t.active_jobs > 0 ? ` (${t.active_jobs} active)` : ""}
                  </option>
                ))}
              </select>
              <FieldError msg={fieldErrors.headInstaller} />
            </div>
          </div>

          {!scheduledAt ? (
            <div className="grid grid-cols-2 gap-4">
              {(["Detailers", "Installers"] as const).map((label) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">
                    {label} <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-dashed border-gray-200 rounded-lg px-4 py-5 flex flex-col items-center gap-1.5 bg-gray-50/60 select-none">
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400 text-center leading-snug">
                      Set a scheduled date &amp; time first to see available {label.toLowerCase()}.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <CrewCheckboxList
                label="Detailers"
                required
                members={detailers}
                selected={selectedDetailerIds}
                onToggle={(id) => toggleCrew(id, selectedDetailerIds, setSelectedDetailerIds, "detailers")}
                loading={loadingRefs}
                error={fieldErrors.detailers}
              />
              <CrewCheckboxList
                label="Installers"
                required
                members={installers}
                selected={selectedInstallerIds}
                onToggle={(id) => toggleCrew(id, selectedInstallerIds, setSelectedInstallerIds, "installers")}
                loading={loadingRefs}
                error={fieldErrors.installers}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3">
          {apiError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {apiError}
            </p>
          )}
          <div className="flex gap-3">
            <Link
              href="/dashboard/job-management"
              className="flex-1 py-3 text-sm font-medium text-gray-700 border border-gray-300 rounded-xl text-center hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={loading || success}
              className={`flex-1 py-3 text-sm font-semibold text-white rounded-xl transition-colors ${
                loading || success ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"
              }`}
            >
              {loading ? "Creating…" : success ? "Created!" : "Create Job Order"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Right: service override panel (always visible) ───────── */}
      <div className="sticky top-6">
        <ServiceOverridePanel
          primaryService={selectedService}
          availableServices={availableServices}
          originalStages={originalStages}
          stagesLoading={stagesLoading}
          customName={customServiceName}
          customDescription={customDescription}
          customDurationMins={customDurationMins}
          customStages={customStages}
          onNameChange={setCustomServiceName}
          onDescriptionChange={setCustomDescription}
          onDurationChange={setCustomDurationMins}
          onStagesChange={setCustomStages}
          onReset={handleResetOverrides}
          onServiceSelect={handleServiceSelect}
          onServiceClear={handleServiceClear}
        />
      </div>
      </div>
    </div>

    {showConfirm && confirmSummary && (
      <JobOrderConfirmDialog
        summary={confirmSummary}
        submitting={loading}
        onConfirm={submitOrder}
        onBack={() => setShowConfirm(false)}
      />
    )}
    </>
  )
}
