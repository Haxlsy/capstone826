"use client"

import { useState, useEffect } from "react"
import {
  Bot, BookOpen, Save, Plus, Pencil, Trash2, X, Check,
  ChevronDown, ChevronUp, Car, Settings, AlertTriangle,
  Users, ClipboardList, Globe, SlidersHorizontal,
} from "lucide-react"
import VehicleStatusTemplate from "./VehicleStatusTemplate"
import ChatbotPreview from "./ChatbotPreview"
import {
  type ChatbotSettings,
  type KBCategory,
  type KBEntry,
  KB_CATEGORIES,
  KB_CATEGORY_COLORS,
} from "@/types/chatbot"

type Tab = "settings" | "knowledge_base" | "vehicle_template"
type Personality = "friendly" | "formal" | "casual"

const DEFAULT_VEHICLE_TEMPLATE = `Hello! Thank you for reaching out to 826 Auto Care. 🚗

To check the status of your vehicle, please provide the following details:

1. Full Name: [Your Full Name]
2. Plate Number: [e.g., ABC-1234]
3. Contact Number: [e.g., 09XX-XXX-XXXX]
4. Email Address: [Your Email]

Once we have your information, we'll look up your vehicle's current service status right away!`

// The admin page also owns two platform-level master toggles that live in the
// persisted settings JSON (kept by chatbotSettingsSchema's passthrough).
type AdminChatbotSettings = ChatbotSettings & {
  enable_ai_chatbot:        boolean
  enable_media_validation:  boolean
}

const DEFAULT_SETTINGS: AdminChatbotSettings = {
  enable_ai_chatbot:       true,
  enable_media_validation: true,
  personality:             "friendly",
  enable_services:         true,
  enable_booking:          true,
  enable_status:           true,
  enable_faq:              true,
  booking_message:         "Thank you! Your request has been sent to our Sales team. They will contact you shortly to confirm your appointment.",
  notify_sales:            true,
  language:                "english",
  escalation_rules:        ["speak_to_human", "complaint", "unanswerable"],
  vehicle_status_template: DEFAULT_VEHICLE_TEMPLATE,
}

const ESCALATION_OPTIONS = [
  { key: "speak_to_human", label: "Customer asks to speak with a human" },
  { key: "complaint",      label: "Complaint or negative feedback" },
  { key: "unanswerable",   label: "Question the AI cannot answer" },
]

interface KBForm {
  category: KBCategory
  topic:    string
  content:  string
}

const EMPTY_KB_FORM: KBForm = { category: "FAQ", topic: "", content: "" }

export default function ChatbotManagement() {
  const [activeTab, setActiveTab] = useState<Tab>("settings")

  // --- Settings state ---
  const [settings, setSettings]       = useState<AdminChatbotSettings>(DEFAULT_SETTINGS)
  const [settingsDirty, setDirty]     = useState(false)
  const [settingsSaved, setSaved]     = useState(false)
  const [settingsError, setError]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  // --- Knowledge base state ---
  const [kbEntries, setKbEntries]     = useState<KBEntry[]>([])
  const [kbLoading, setKbLoading]     = useState(true)
  const [kbError, setKbError]         = useState<string | null>(null)
  const [kbSaving, setKbSaving]       = useState(false)
  const [addOpen, setAddOpen]         = useState(false)
  const [editId, setEditId]           = useState<string | null>(null)
  const [form, setForm]               = useState<KBForm>(EMPTY_KB_FORM)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/chatbot/config")
      .then((r) => r.json())
      .then(({ config }) => {
        if (config?.settings) setSettings({ ...DEFAULT_SETTINGS, ...config.settings })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchKnowledge()
  }, [])

  async function fetchKnowledge() {
    setKbLoading(true)
    setKbError(null)
    try {
      const res = await fetch("/api/admin/chatbot/knowledge")
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load knowledge base.")
      setKbEntries(json.entries ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load knowledge base."
      setKbError(msg)
    } finally {
      setKbLoading(false)
    }
  }

  function patch<K extends keyof AdminChatbotSettings>(key: K, value: AdminChatbotSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
    setSaved(false)
    setError(null)
  }

  function toggleEscalation(key: string) {
    setSettings((prev) => {
      const has = prev.escalation_rules.includes(key)
      return { ...prev, escalation_rules: has ? prev.escalation_rules.filter((k) => k !== key) : [...prev.escalation_rules, key] }
    })
    setDirty(true)
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    try {
      const res = await fetch("/api/admin/chatbot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Failed to save settings."); return }
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Network error. Please try again.")
    }
  }

  // KB helpers
  function openAdd() { setForm(EMPTY_KB_FORM); setEditId(null); setAddOpen(true) }
  function openEdit(entry: KBEntry) {
    setForm({ category: entry.category, topic: entry.topic, content: entry.content })
    setEditId(entry.id)
    setAddOpen(true)
  }
  function closeForm() { setAddOpen(false); setEditId(null); setForm(EMPTY_KB_FORM) }

  async function saveEntry() {
    if (!form.topic.trim() || !form.content.trim() || kbSaving) return
    setKbSaving(true)
    setKbError(null)
    try {
      const payload = {
        category: form.category,
        topic:    form.topic.trim(),
        content:  form.content.trim(),
      }
      const res = await fetch(editId ? `/api/admin/chatbot/knowledge/${editId}` : "/api/admin/chatbot/knowledge", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to save entry.")
      await fetchKnowledge()
      closeForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save entry."
      setKbError(msg)
    } finally {
      setKbSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    if (kbSaving) return
    setKbSaving(true)
    setKbError(null)
    try {
      const res = await fetch(`/api/admin/chatbot/knowledge/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to delete entry.")
      setKbEntries((prev) => prev.filter((e) => e.id !== id))
      setDeleteConfirmId(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete entry."
      setKbError(msg)
    } finally {
      setKbSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">AI Chatbot Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configure how your chatbot interacts with customers.</p>
      </div>

      <div className="flex border-b border-gray-200 gap-1">
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<Settings className="w-4 h-4" />} label="Chatbot Settings" />
        <TabButton active={activeTab === "knowledge_base"} onClick={() => setActiveTab("knowledge_base")} icon={<BookOpen className="w-4 h-4" />} label="Knowledge Base" />
        <TabButton active={activeTab === "vehicle_template"} onClick={() => setActiveTab("vehicle_template")} icon={<Car className="w-4 h-4" />} label="Vehicle Status Template" />
      </div>

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="flex gap-6 items-start">
        {/* Left — form */}
        <div className="flex flex-col gap-5 flex-1 min-w-0 max-w-2xl">
          {loading && <p className="text-sm text-gray-400">Loading settings…</p>}

          {/* 0 — System Controls */}
          <Section icon={<SlidersHorizontal className="w-4 h-4" />} title="System Controls" subtitle="Master switches for AI-powered features across the platform.">
            <div className="flex flex-col gap-3">
              <Toggle
                checked={settings.enable_ai_chatbot}
                onChange={(v) => patch("enable_ai_chatbot", v)}
                label="Enable AI Chatbot — allow the Gemini-powered chatbot to respond to customer messages on Messenger"
              />
              <Toggle
                checked={settings.enable_media_validation}
                onChange={(v) => patch("enable_media_validation", v)}
                label="Enable AI Media Validation — use Gemini to automatically verify that photos or videos uploaded by technicians are relevant to the stage being completed"
              />
            </div>
          </Section>

          {/* A — Personality */}
          <Section icon={<Bot className="w-4 h-4" />} title="Bot Personality" subtitle="Choose the tone the chatbot uses when talking to customers.">
            <div className="flex gap-3 flex-wrap">
              {(["friendly", "formal", "casual"] as Personality[]).map((p) => {
                const labels: Record<Personality, string> = { friendly: "Friendly & Professional", formal: "Formal & Concise", casual: "Casual & Conversational" }
                return (
                  <button
                    key={p}
                    onClick={() => patch("personality", p)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      settings.personality === p
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {labels[p]}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* B — Capabilities */}
          <Section icon={<ClipboardList className="w-4 h-4" />} title="What the Bot Can Handle" subtitle="Turn on the topics your chatbot should be able to help with.">
            <div className="flex flex-col gap-3">
              <Toggle checked={settings.enable_services} onChange={(v) => patch("enable_services", v)} label="Answer questions about services and pricing" />
              <Toggle checked={settings.enable_booking}  onChange={(v) => patch("enable_booking",  v)} label="Collect booking information from customers" />
              <Toggle checked={settings.enable_status}   onChange={(v) => patch("enable_status",   v)} label="Help customers check their vehicle status" />
              <Toggle checked={settings.enable_faq}      onChange={(v) => patch("enable_faq",      v)} label="Answer general FAQs" />
            </div>
          </Section>

          {/* C — Booking Setup */}
          {settings.enable_booking && (
            <Section icon={<Users className="w-4 h-4" />} title="Booking Setup" subtitle="How the chatbot handles customers who want to book a service.">
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700">
                    The AI does <strong>not</strong> confirm bookings. It collects the customer&apos;s details and notifies your Sales team — the customer is told Sales will reach out.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-gray-700">Information collected from customer</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["Full Name", "Contact Number", "Plate Number", "Vehicle Type"].map((f) => (
                      <div key={f} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        <span className="text-sm text-gray-600">{f}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">These fields are always collected and cannot be changed.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Message sent to customer after collecting info</label>
                  <textarea
                    value={settings.booking_message}
                    onChange={(e) => patch("booking_message", e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Toggle
                    checked={settings.notify_sales}
                    onChange={(v) => patch("notify_sales", v)}
                    label="Notify Sales team when a booking request comes in"
                  />
                  <p className="text-xs text-gray-400 ml-12">Booking requests will appear in the Inquiries section for your Sales team to action.</p>
                </div>
              </div>
            </Section>
          )}

          {/* E — Language */}
          <Section icon={<Globe className="w-4 h-4" />} title="Response Language" subtitle="Choose the language the chatbot uses when talking to customers.">
            <div className="flex gap-3">
              {(["english", "filipino", "both"] as const).map((lang) => {
                const labels: Record<string, string> = { english: "English", filipino: "Filipino", both: "Both" }
                return (
                  <button
                    key={lang}
                    onClick={() => patch("language", lang)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      settings.language === lang
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {labels[lang]}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* F — Escalation */}
          <Section icon={<Users className="w-4 h-4" />} title="When AI Passes to Staff" subtitle="The chatbot will hand the conversation to your team in these situations.">
            <div className="flex flex-col gap-3">
              {ESCALATION_OPTIONS.map((o) => (
                <label key={o.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.escalation_rules.includes(o.key)}
                    onChange={() => toggleEscalation(o.key)}
                    className="w-4 h-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">{o.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Save */}
          {settingsError && (
            <p className="text-sm text-red-500">{settingsError}</p>
          )}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={handleSave}
              disabled={!settingsDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                settingsDirty
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
            {settingsSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
        {/* Right — preview */}
        <div className="hidden lg:flex w-80 xl:w-96 shrink-0 sticky top-0 h-[680px]">
          <ChatbotPreview settings={settings} />
        </div>
        </div>
      )}

      {/* Vehicle Status Template Tab */}
      {activeTab === "vehicle_template" && (
        <VehicleStatusTemplate
          value={settings.vehicle_status_template}
          onChange={(v) => patch("vehicle_status_template", v)}
          onSave={handleSave}
          saved={settingsSaved}
          saving={settingsDirty}
        />
      )}

      {/* Knowledge Base Tab */}
      {activeTab === "knowledge_base" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {kbEntries.length} {kbEntries.length === 1 ? "entry" : "entries"} in the knowledge base.
            </p>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          {kbError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {kbError}
            </div>
          )}

          {addOpen && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">{editId ? "Edit Entry" : "New Entry"}</p>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KBCategory }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {KB_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Question / Topic</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g., What are your business hours?"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Answer</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  placeholder="Enter the chatbot's response for this topic…"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveEntry}
                  disabled={!form.topic.trim() || !form.content.trim() || kbSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {kbSaving ? "Saving…" : editId ? "Save Changes" : "Add Entry"}
                </button>
                <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {kbLoading && !kbError && (
              <div className="text-center py-10 text-sm text-gray-400">Loading knowledge base…</div>
            )}
            {!kbLoading && kbEntries.length === 0 && !kbError && (
              <div className="text-center py-10 text-sm text-gray-400">No knowledge base entries yet. Add one above.</div>
            )}
            {kbEntries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isDeleteConfirm = deleteConfirmId === entry.id
              return (
                <div key={entry.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${KB_CATEGORY_COLORS[entry.category]}`}>
                      {entry.category}
                    </span>
                    <p className="flex-1 text-sm font-medium text-gray-800 truncate">{entry.topic}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(entry) }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id) }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 border-t border-gray-100">
                      <p className="text-sm text-gray-600 leading-relaxed mt-3">{entry.content}</p>
                    </div>
                  )}
                  {isDeleteConfirm && (
                    <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                      <p className="text-sm text-red-600">Remove this entry?</p>
                      <div className="flex gap-2">
                        <button onClick={() => deleteEntry(entry.id)} disabled={kbSaving} className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">Remove</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-white transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-gray-400">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-gray-900" : "bg-gray-200"}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}