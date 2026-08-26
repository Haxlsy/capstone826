"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  MessageCircle, ArrowRightLeft, Clock,
  CheckCircle2, ChevronRight, User, Car,
  Phone, Hash, CheckCheck, CircleDot, X, Search,
  AlertCircle, Mail, Layers, AlertTriangle,
} from "lucide-react"
import { fmtDateTime } from "@/lib/time-display"

type InquiryStatus = "open" | "resolved" | "recorded"
type InquiryType   = "Booking" | "Human Response" | "Report"

interface Inquiry {
  id:                string
  psid:              string
  messengerName:     string
  timeElapsed:       string
  escalationDate:    string
  type:              InquiryType
  status:            InquiryStatus
  extractedName:     string | null
  extractedContact:  string | null
  extractedEmail:    string | null
  extractedPlate:    string | null
  extractedVehicle:  string | null
  lastMessage:       string | null
  conflictNote:      string | null
}

type Tab = "all" | "unresolved" | "open" | "recorded" | "resolved"

const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "All" },
  { key: "unresolved", label: "Unresolved" },
  { key: "open",       label: "Unrecorded" },
  { key: "recorded",   label: "Recorded" },
  { key: "resolved",   label: "Resolved" },
]

const STATUS_COLORS: Record<InquiryStatus, string> = {
  open:     "bg-orange-100 text-orange-700 border-orange-200",
  recorded: "bg-blue-100 text-blue-700 border-blue-200",
  resolved: "bg-gray-100 text-gray-500 border-gray-200",
}

const STATUS_DOT: Record<InquiryStatus, string> = {
  open:     "bg-orange-400",
  recorded: "bg-blue-500",
  resolved: "bg-gray-300",
}

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open:     "Unrecorded",
  recorded: "Recorded",
  resolved: "Resolved",
}

const TYPE_COLORS: Record<InquiryType, string> = {
  Booking:         "bg-blue-50 text-blue-600 border-blue-200",
  "Human Response":"bg-purple-50 text-purple-600 border-purple-200",
  Report:          "bg-yellow-50 text-yellow-600 border-yellow-200",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs} hour${hrs > 1 ? "s" : ""} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
}

const INPUT_CLS = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

export default function InquiryManagement() {
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [inquiries, setInquiries]   = useState<Inquiry[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<Tab>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState("")

  // Record modal
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordForm, setRecordForm] = useState({ full_name: "", contact_number: "", email: "", plate_number: "", vehicle_unit: "" })
  const [recording, setRecording]   = useState(false)
  const [recordErrors, setRecordErrors] = useState<Record<string, string>>({})

  // Validation patterns
  const PLATE_RE = /^[A-Z]{1,4}\s?-?\s?\d{1,6}(?:\s?-\s?[A-Z]{1,2})?$/i
  const PHONE_RE = /^(?:\+?63|0)\s?9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}$/
  const EMAIL_RE = /^[\w.+-]+@[\w-]+\.[\w.]+$/
  const NAME_RE  = /^[A-Za-z\s.'-]{2,}$/

  function validateRecordForm(): Record<string, string> {
    const errs: Record<string, string> = {}
    const { full_name, contact_number, email, plate_number, vehicle_unit } = recordForm

    if (!full_name.trim()) {
      errs.full_name = "Full name is required."
    } else if (!NAME_RE.test(full_name.trim())) {
      errs.full_name = "Full name must be at least 2 characters (letters, spaces, dots, hyphens only)."
    }

    if (!contact_number.trim()) {
      errs.contact_number = "Contact number is required."
    } else if (!PHONE_RE.test(contact_number.trim())) {
      errs.contact_number = "Enter a valid PH mobile number (e.g., 09171234567)."
    }

    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      errs.email = "Enter a valid email address (e.g., juan@email.com)."
    }

    if (!plate_number.trim()) {
      errs.plate_number = "Plate number is required."
    } else if (!PLATE_RE.test(plate_number.trim())) {
      errs.plate_number = "Enter a valid plate number (e.g., ABC 1234, ABC-1234)."
    }

    if (!vehicle_unit.trim()) {
      errs.vehicle_unit = "Vehicle unit is required."
    } else if (vehicle_unit.trim().length < 2) {
      errs.vehicle_unit = "Vehicle unit must be at least 2 characters."
    }

    return errs
  }

  // Resolve confirm
  const [resolveTarget, setResolveTarget] = useState<string | null>(null)
  const [resolvingId, setResolvingId]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/sales/inquiries")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load inquiries")

      const shaped: Inquiry[] = (json.inquiries ?? []).map((i: any) => ({
        id:               i.id,
        psid:             i.psid,
        messengerName:    i.messenger_name,
        timeElapsed:      timeAgo(i.escalated_at),
        escalationDate:   fmtDateTime(i.escalated_at),
        type:             i.inquiry_type as InquiryType,
        status:           i.status as InquiryStatus,
        extractedName:    i.extracted_name    ?? null,
        extractedContact: i.extracted_contact ?? null,
        extractedEmail:   i.extracted_email   ?? null,
        extractedPlate:   i.extracted_plate   ?? null,
        extractedVehicle: i.extracted_vehicle ?? null,
        lastMessage:      i.last_message      ?? null,
        conflictNote:     i.conflict_note     ?? null,
      }))
      setInquiries(shaped)
      if (!selectedId && shaped.length > 0) setSelectedId(shaped[0].id)
    } catch {}
    finally { setLoading(false) }
  }, [selectedId])

  useEffect(() => { load() }, [load])

  useEffect(()=>{
    const supabase = createClient();

    const channel = supabase
    .channel('inquiries-realtime')
    .on(
      "postgres_changes",
      {event: "INSERT", schema: "public", table: "inquiry"},
      ()=>{
        load()
      }
    )
    .subscribe()

    return () =>{
      supabase.removeChannel(channel);
    }
  }, [load])

  useEffect(() => {
    const el = tabBarRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const tabFiltered = activeTab === "all"
    ? inquiries
    : activeTab === "unresolved"
      ? inquiries.filter((i) => i.status === "open" || i.status === "recorded")
      : inquiries.filter((i) => i.status === activeTab)
  const filtered    = search.trim()
    ? tabFiltered.filter((i) => {
        const q = search.toLowerCase()
        return [i.messengerName, i.extractedName, i.extractedVehicle, i.extractedPlate, i.extractedContact, i.extractedEmail]
          .some((f) => f?.toLowerCase().includes(q))
      })
    : tabFiltered

  const selected      = inquiries.find((i) => i.id === selectedId) ?? null
  const totalCount    = inquiries.length
  const openCount     = inquiries.filter((i) => i.status === "open").length
  const recCount      = inquiries.filter((i) => i.status === "recorded").length
  const resCount      = inquiries.filter((i) => i.status === "resolved").length
  const unresolvedCnt = openCount + recCount

  function openRecordModal(inq: Inquiry) {
    setRecordForm({
      full_name:      inq.extractedName    ?? "",
      contact_number: inq.extractedContact ?? "",
      email:          inq.extractedEmail   ?? "",
      plate_number:   inq.extractedPlate   ?? "",
      vehicle_unit:   inq.extractedVehicle ?? "",
    })
    setRecordErrors({})
    setRecordOpen(true)
  }

  async function submitRecord() {
    if (!selected) return

    const errs = validateRecordForm()
    setRecordErrors(errs)
    if (Object.keys(errs).length > 0) return

    setRecording(true)
    setRecordErrors({})
    try {
      const trimmed = {
        full_name:      recordForm.full_name.trim(),
        contact_number: recordForm.contact_number.trim(),
        email:          recordForm.email.trim() || null,
        plate_number:   recordForm.plate_number.trim().toUpperCase(),
        vehicle_unit:   recordForm.vehicle_unit.trim(),
      }
      const crRes  = await fetch("/api/sales/customer-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...trimmed, psid: selected.psid }),
      })
      const crJson = await crRes.json()
      if (!crRes.ok) throw new Error(crJson?.error ?? "Failed to create customer record")

      await fetch(`/api/sales/inquiries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "recorded" }),
      })

      setInquiries((prev) => prev.map((i) => i.id === selected.id ? { ...i, status: "recorded" } : i))
      setRecordOpen(false)
    } catch (err: unknown) {
      setRecordErrors({ _submit: err instanceof Error ? err.message : String(err) })
    } finally {
      setRecording(false)
    }
  }

  async function confirmResolve() {
    if (!resolveTarget) return
    setResolvingId(resolveTarget)
    try {
      const res = await fetch(`/api/sales/inquiries/${resolveTarget}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      if (res.ok) setInquiries((prev) => prev.map((i) => i.id === resolveTarget ? { ...i, status: "resolved" } : i))
    } catch {}
    setResolvingId(null)
    setResolveTarget(null)
  }

  return (
    <div className="flex flex-col h-full gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Inquiry Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Escalated chatbot conversations requiring Sales action.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <StatPill label="Total"       count={totalCount}    icon={Layers}         color="text-indigo-500" bg="bg-indigo-50"  border="border-indigo-200" />
        <StatPill label="Unresolved"  count={unresolvedCnt} icon={AlertCircle}    color="text-orange-500" bg="bg-orange-50"  border="border-orange-200" />
        <StatPill label="Unrecorded"  count={openCount}     icon={Clock}          color="text-amber-500"  bg="bg-amber-50"   border="border-amber-200" />
        <StatPill label="Recorded"    count={recCount}      icon={ArrowRightLeft} color="text-blue-600"   bg="bg-blue-50"    border="border-blue-200" />
        <StatPill label="Resolved"    count={resCount}      icon={CheckCheck}     color="text-emerald-600" bg="bg-emerald-50" border="border-emerald-200" />
      </div>

      {/* Main Panel */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: List */}
        <div className="flex flex-col w-96 shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div ref={tabBarRef} className="flex border-b border-gray-100 px-3 pt-2 gap-0.5 overflow-x-auto overflow-y-hidden scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, vehicle…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-10">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No inquiries.</p>
            ) : (
              filtered.map((inq) => (
                <button
                  key={inq.id}
                  onClick={() => setSelectedId(inq.id)}
                  className={`w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50 transition-colors ${
                    selectedId === inq.id ? "bg-blue-50/60" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold shrink-0 text-gray-700">
                    {inq.extractedName ? getInitials(inq.extractedName) : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-sm font-semibold text-gray-800 truncate leading-tight">{inq.messengerName}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[inq.status]}`}>
                        {STATUS_LABELS[inq.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[inq.type]}`}>
                        {inq.type}
                      </span>
                      {inq.conflictNote && (
                        <AlertTriangle className="w-3 h-3 text-amber-500" aria-label="Identity conflict" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{inq.timeElapsed}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail */}
        {selected ? (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-5 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-700">
                  {selected.extractedName ? getInitials(selected.extractedName) : "?"}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-800">{selected.messengerName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{selected.escalationDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${TYPE_COLORS[selected.type]}`}>
                  {selected.type}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selected.status]}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Escalation Date</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 h-[58px]">
                  <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Flagged At</p>
                    <p className="text-sm font-semibold text-gray-700 whitespace-nowrap">{selected.escalationDate}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Messenger Identity</p>
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3 h-[58px]">
                  <Hash className="w-4 h-4 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-400">Page-Scoped ID</p>
                    <p className="text-sm font-mono font-semibold text-gray-700 truncate">{selected.psid}</p>
                  </div>
                </div>
              </div>
            </div>

            {selected.conflictNote && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Identity Conflict</p>
                  <p className="text-sm text-amber-800 mt-1">{selected.conflictNote}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI-Extracted Fields</p>
              <div className="bg-gray-50 border border-gray-100 rounded-xl divide-y divide-gray-100 overflow-hidden">
                <FieldRow label="Full name"      value={selected.extractedName}    icon={<User  className="w-3.5 h-3.5 text-gray-400" />} />
                <FieldRow label="Plate number"   value={selected.extractedPlate}   icon={<Car   className="w-3.5 h-3.5 text-gray-400" />} />
                <FieldRow label="Contact number" value={selected.extractedContact} icon={<Phone className="w-3.5 h-3.5 text-gray-400" />} />
                <FieldRow label="Email"          value={selected.extractedEmail}   icon={<Mail  className="w-3.5 h-3.5 text-gray-400" />} />
              </div>
            </div>

            <div className="mt-auto pt-4 flex flex-col gap-3">
              {selected.type === "Booking" && selected.status === "open" && (
                <div>
                  <button
                    onClick={() => openRecordModal(selected)}
                    disabled={!selected.extractedName || !selected.extractedContact || !selected.extractedPlate || !selected.extractedVehicle}
                    className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-900"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Record Customer Details
                  </button>
                  {(!selected.extractedName || !selected.extractedContact || !selected.extractedPlate || !selected.extractedVehicle) && (
                    <p className="text-[10px] text-gray-400 text-center mt-2 px-4">
                      AI fields must be populated before recording details.
                    </p>
                  )}
                </div>
              )}

              {selected.status === "recorded" && (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Customer Details Recorded
                </div>
              )}

              {selected.status === "open" && (
                <button
                  onClick={() => setResolveTarget(selected.id)}
                  disabled={resolvingId === selected.id}
                  className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <CircleDot className="w-4 h-4" />
                  Mark as Resolved
                </button>
              )}

              {selected.status === "resolved" && (
                <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-sm font-medium">
                  <CheckCheck className="w-4 h-4" />
                  Resolved
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white border border-gray-200 rounded-2xl flex items-center justify-center">
            <p className="text-sm text-gray-400">Select an inquiry to view details.</p>
          </div>
        )}
      </div>

      {/* Resolve Confirm Dialog */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <CheckCheck className="w-5 h-5 text-gray-500" />
              </div>
              <h2 className="text-base font-bold text-gray-800">Mark as Resolved?</h2>
              <p className="text-sm text-gray-500 mt-1.5">
                This inquiry will be marked as resolved and moved out of the active queue.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setResolveTarget(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResolve}
                disabled={!!resolvingId}
                className="flex-1 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-60"
              >
                {resolvingId ? "Resolving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Customer Details Modal */}
      {recordOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-gray-800">Record Customer Details</h3>
              <button aria-label="Close" onClick={() => setRecordOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "Full Name *",      key: "full_name",      type: "text",  placeholder: "e.g. Juan Dela Cruz" },
                { label: "Contact Number *", key: "contact_number", type: "tel",   placeholder: "e.g. 09171234567" },
                { label: "Email",            key: "email",          type: "email", placeholder: "e.g. juan@email.com" },
                { label: "Plate Number *",   key: "plate_number",   type: "text",  placeholder: "e.g. ABC 1234" },
                { label: "Vehicle Unit *",   key: "vehicle_unit",   type: "text",  placeholder: "e.g. Toyota Fortuner" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={(recordForm as Record<string, string>)[key]}
                    onChange={(e) => {
                      setRecordForm((prev) => ({ ...prev, [key]: e.target.value }))
                      if (recordErrors[key]) setRecordErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
                    }}
                    placeholder={placeholder}
                    className={`${INPUT_CLS} ${recordErrors[key] ? "border-red-400 focus:ring-red-500" : ""}`}
                  />
                  {recordErrors[key] && (
                    <p className="text-[11px] text-red-500 mt-1">{recordErrors[key]}</p>
                  )}
                </div>
              ))}
            </div>

            {recordErrors._submit && <p className="text-xs text-red-500 mt-3">{recordErrors._submit}</p>}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRecordOpen(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRecord}
                disabled={recording}
                className="flex-1 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {recording ? "Recording…" : "Record & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatPill({ label, count, icon: Icon, color, bg, border }: {
  label: string; count: number; icon: React.ElementType
  color: string; bg: string; border: string
}) {
  return (
    <div className={`flex items-center gap-3 bg-white border ${border} rounded-xl px-4 py-3`}>
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-800 leading-none">{count}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function FieldRow({ label, value, icon }: { label: string; value: string | null; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {icon}
        {label}
      </div>
      <span className={`text-sm font-semibold ${value ? "text-blue-600" : "text-gray-300"}`}>
        {value ?? "—"}
      </span>
    </div>
  )
}
