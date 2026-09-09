"use client"

import { useState, useEffect } from "react"
import {
  Bot, BookOpen, Save, Plus, Pencil, Trash2, X, Check,
  ChevronDown, ChevronUp, MessageSquare, Settings, AlertTriangle,
  Globe, SlidersHorizontal, Users, Search,
} from "lucide-react"
import MessageTemplates from "./MessageTemplates"
import ChatbotPreview from "./ChatbotPreview"
import { useToast } from "@/components/ui/Toast"
import {
  type ChatbotSettings,
  type KBCategory,
  type KBEntry,
  KB_CATEGORIES,
  KB_CATEGORY_COLORS,
  DEFAULT_AI_DISABLED_MESSAGE,
  DEFAULT_VEHICLE_STATUS_MESSAGE_EN,
  DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  DEFAULT_LINK_VERIFICATION_MESSAGE_EN,
  DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
  DEFAULT_ESCALATION_MESSAGE_EN,
  DEFAULT_ESCALATION_MESSAGE_FIL,
  DEFAULT_RESOLVED_MESSAGE_EN,
  DEFAULT_RESOLVED_MESSAGE_FIL,
  DEFAULT_BOOKING_MESSAGE_EN,
  DEFAULT_BOOKING_MESSAGE_FIL,
  DEFAULT_OPERATING_DAYS,
  DEFAULT_OPERATING_OPEN_TIME,
  DEFAULT_OPERATING_CLOSE_TIME,
  formatOperatingHours,
  WEEKDAYS,
  type Weekday,
} from "@/types/chatbot"

type Tab = "settings" | "knowledge_base" | "message_templates"
type Personality = "friendly" | "formal"

// The master toggles are part of chatbotSettingsSchema now, so ChatbotSettings
// already carries them; the alias is kept for readability at the call sites.
type AdminChatbotSettings = ChatbotSettings

const DEFAULT_SETTINGS: AdminChatbotSettings = {
  enable_ai_chatbot:       true,
  enable_media_validation: true,
  ai_disabled_message:     DEFAULT_AI_DISABLED_MESSAGE,
  personality:             "friendly",
  language:                "english",
  operating_days:               DEFAULT_OPERATING_DAYS,
  operating_open_time:          DEFAULT_OPERATING_OPEN_TIME,
  operating_close_time:         DEFAULT_OPERATING_CLOSE_TIME,
  // Seeded from the message the system actually sends, so the editor opens
  // showing exactly what customers receive today.
  vehicle_status_message_en:     DEFAULT_VEHICLE_STATUS_MESSAGE_EN,
  vehicle_status_message_fil:    DEFAULT_VEHICLE_STATUS_MESSAGE_FIL,
  link_verification_message_en:  DEFAULT_LINK_VERIFICATION_MESSAGE_EN,
  link_verification_message_fil: DEFAULT_LINK_VERIFICATION_MESSAGE_FIL,
  escalation_message_en:         DEFAULT_ESCALATION_MESSAGE_EN,
  escalation_message_fil:        DEFAULT_ESCALATION_MESSAGE_FIL,
  resolved_message_en:           DEFAULT_RESOLVED_MESSAGE_EN,
  resolved_message_fil:          DEFAULT_RESOLVED_MESSAGE_FIL,
  booking_message_en:            DEFAULT_BOOKING_MESSAGE_EN,
  booking_message_fil:           DEFAULT_BOOKING_MESSAGE_FIL,
}

interface KBForm {
  category: KBCategory
  topic:    string
  content:  string
}

const EMPTY_KB_FORM: KBForm = { category: "FAQ", topic: "", content: "" }

export default function ChatbotManagement() {
  const toast = useToast()
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
  const [kbSearch, setKbSearch]               = useState("")
  const [kbCategoryFilter, setKbCategoryFilter] = useState<KBCategory | "All">("All")

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
      toast.success("Chatbot settings saved.")
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

  const kbSearchActive = kbSearch.trim().length > 0 || kbCategoryFilter !== "All"
  const filteredKbEntries = kbEntries.filter((entry) => {
    if (kbCategoryFilter !== "All" && entry.category !== kbCategoryFilter) return false
    const q = kbSearch.trim().toLowerCase()
    if (!q) return true
    return entry.topic.toLowerCase().includes(q) || entry.category.toLowerCase().includes(q)
  })

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-heading">AI Configuration Management</h1>
        <p className="text-sm text-muted mt-0.5">Configure how your chatbot interacts with customers.</p>
      </div>

      <div className="flex border-b border-border gap-1">
        <TabButton active={activeTab === "settings"} onClick={() => setActiveTab("settings")} icon={<Settings className="w-4 h-4" />} label="AI Settings" />
        <TabButton active={activeTab === "knowledge_base"} onClick={() => setActiveTab("knowledge_base")} icon={<BookOpen className="w-4 h-4" />} label="Knowledge Base" />
        <TabButton active={activeTab === "message_templates"} onClick={() => setActiveTab("message_templates")} icon={<MessageSquare className="w-4 h-4" />} label="Message Templates" />
      </div>

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="flex gap-6 items-start">
        {/* Left — form */}
        <div className="flex flex-col gap-5 flex-1 min-w-0 max-w-2xl">
          {loading && <p className="text-sm text-muted">Loading settings…</p>}

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
              {!settings.enable_ai_chatbot && (
                <div className="ml-12 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-body">
                    Auto-reply sent while the AI chatbot is off
                  </label>
                  <textarea
                    value={settings.ai_disabled_message}
                    onChange={(e) => patch("ai_disabled_message", e.target.value)}
                    rows={3}
                    className="w-full border border-border rounded-card px-4 py-3 text-sm text-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <p className="text-xs text-muted">
                    Sent once per customer message, then the conversation is handed to your Sales team.
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* A — Personality */}
          <Section icon={<Bot className="w-4 h-4" />} title="Bot Personality" subtitle="Choose the tone the chatbot uses when talking to customers.">
            <div className="flex gap-3 flex-wrap">
              {(["friendly", "formal"] as Personality[]).map((p) => {
                const labels: Record<Personality, string> = { friendly: "Friendly", formal: "Formal" }
                return (
                  <button
                    key={p}
                    onClick={() => patch("personality", p)}
                    className={`px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
                      settings.personality === p
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-body border-border hover:border-primary/40"
                    }`}
                  >
                    {labels[p]}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Operating Hours — drives both the AI chatbot's answers and the
              "For Release" customer message; see formatOperatingHours in
              types/chatbot.ts, the single source both sides read. */}
          <Section icon={<Globe className="w-4 h-4" />} title="Operating Hours" subtitle="When customers can reach you and pick up their vehicle. The chatbot and pickup-ready messages use this directly.">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-body mb-2">Open days</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => {
                    const labels: Record<Weekday, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" }
                    const isOpen = settings.operating_days.includes(day)
                    return (
                      <button
                        key={day}
                        onClick={() => {
                          const next = isOpen
                            ? settings.operating_days.filter((d) => d !== day)
                            : [...settings.operating_days, day]
                          patch("operating_days", next)
                        }}
                        className={`w-14 py-2 rounded-card text-sm font-medium border transition-colors ${
                          isOpen
                            ? "bg-primary text-white border-primary"
                            : "bg-surface text-body border-border hover:border-primary/40"
                        }`}
                      >
                        {labels[day]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-body">Opens</label>
                  <input
                    type="time"
                    value={settings.operating_open_time}
                    onChange={(e) => patch("operating_open_time", e.target.value)}
                    className="border border-border rounded-sm px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-body">Closes</label>
                  <input
                    type="time"
                    value={settings.operating_close_time}
                    onChange={(e) => patch("operating_close_time", e.target.value)}
                    className="border border-border rounded-sm px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="rounded-card bg-surface-muted px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Customers will see</p>
                <p className="text-sm text-body">{formatOperatingHours(settings)}</p>
              </div>
            </div>
          </Section>

          {/* E — Language */}
          <Section icon={<Globe className="w-4 h-4" />} title="Response Language" subtitle="Choose the language the chatbot uses when talking to customers.">
            <div className="flex gap-3">
              {(["english", "filipino", "both"] as const).map((lang) => {
                const labels: Record<string, string> = { english: "English", filipino: "Filipino", both: "Both" }
                return (
                  <button
                    key={lang}
                    onClick={() => patch("language", lang)}
                    className={`px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
                      settings.language === lang
                        ? "bg-primary text-white border-primary"
                        : "bg-surface text-body border-border hover:border-primary/40"
                    }`}
                  >
                    {labels[lang]}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Save */}
          {settingsError && (
            <p className="text-sm text-status-delayed">{settingsError}</p>
          )}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={handleSave}
              disabled={!settingsDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-semibold transition-colors ${
                settingsDirty
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-surface-muted text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
            {settingsSaved && (
              <span className="flex items-center gap-1.5 text-sm text-status-inspection">
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

      {/* Message Templates Tab */}
      {activeTab === "message_templates" && (
        <MessageTemplates
          settings={settings}
          patch={patch}
          onSave={handleSave}
          saved={settingsSaved}
          saving={settingsDirty}
        />
      )}

      {/* Knowledge Base Tab */}
      {activeTab === "knowledge_base" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-body">
              {kbSearchActive
                ? `${filteredKbEntries.length} of ${kbEntries.length} ${kbEntries.length === 1 ? "entry" : "entries"} shown.`
                : `${kbEntries.length} ${kbEntries.length === 1 ? "entry" : "entries"} in the knowledge base.`}
            </p>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-card hover:bg-primary-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 w-3.5 h-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={kbSearch}
                onChange={(e) => setKbSearch(e.target.value)}
                placeholder="Search by topic or category…"
                className="w-full rounded-sm border border-border py-2 pl-8 pr-3 text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={kbCategoryFilter}
              onChange={(e) => setKbCategoryFilter(e.target.value as KBCategory | "All")}
              className="border border-border rounded-sm bg-surface px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-48"
            >
              <option value="All">All Categories</option>
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {kbError && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-status-delayed/10 border border-status-delayed/30 rounded-card text-sm text-status-delayed">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {kbError}
            </div>
          )}

          {addOpen && (
            <div className="bg-surface border border-border rounded-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-heading">{editId ? "Edit Entry" : "New Entry"}</p>
                <button onClick={closeForm} className="text-muted hover:text-body"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-body">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KBCategory }))}
                    className="border border-border rounded-sm px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {KB_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body">Question / Topic</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g., What are your business hours?"
                  className="border border-border rounded-sm px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body">Answer</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={4}
                  placeholder="Enter the chatbot's response for this topic…"
                  className="border border-border rounded-sm px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveEntry}
                  disabled={!form.topic.trim() || !form.content.trim() || kbSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-sm hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {kbSaving ? "Saving…" : editId ? "Save Changes" : "Add Entry"}
                </button>
                <button onClick={closeForm} className="px-4 py-2 text-sm text-body border border-border rounded-sm hover:bg-surface-muted transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {kbLoading && !kbError && (
              <div className="text-center py-10 text-sm text-muted">Loading knowledge base…</div>
            )}
            {!kbLoading && kbEntries.length === 0 && !kbError && (
              <div className="text-center py-10 text-sm text-muted">No knowledge base entries yet. Add one above.</div>
            )}
            {!kbLoading && kbEntries.length > 0 && filteredKbEntries.length === 0 && !kbError && (
              <div className="text-center py-10 text-sm text-muted">No entries match your search or filter.</div>
            )}
            {filteredKbEntries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isDeleteConfirm = deleteConfirmId === entry.id
              return (
                <div key={entry.id} className="bg-surface border border-border rounded-card overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface-muted/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${KB_CATEGORY_COLORS[entry.category]}`}>
                      {entry.category}
                    </span>
                    <p className="flex-1 text-sm font-medium text-heading truncate">{entry.topic}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(entry) }} className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded-sm transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id) }} className="p-1.5 text-muted hover:text-status-delayed hover:bg-status-delayed/10 rounded-sm transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 border-t border-border-subtle">
                      <p className="text-sm text-body leading-relaxed mt-3">{entry.content}</p>
                    </div>
                  )}
                  {isDeleteConfirm && (
                    <div className="px-5 py-3 bg-status-delayed/10 border-t border-status-delayed/30 flex items-center justify-between">
                      <p className="text-sm text-status-delayed">Remove this entry?</p>
                      <div className="flex gap-2">
                        <button onClick={() => deleteEntry(entry.id)} disabled={kbSaving} className="px-3 py-1.5 text-xs font-medium bg-status-delayed text-white rounded-sm hover:brightness-95 transition-colors">Remove</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 text-xs font-medium border border-border text-body rounded-sm hover:bg-surface transition-colors">Cancel</button>
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
    <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-heading">{title}</p>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
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
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-primary" : "bg-surface-muted"}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-surface shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      <span className="text-sm text-body">{label}</span>
    </label>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-primary text-heading" : "border-transparent text-muted hover:text-body"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}