"use client"

import { useState, useEffect, useMemo } from "react"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"
import {
  Bot, BookOpen, Save, Plus, Pencil, Trash2, Check, X,
  ChevronDown, ChevronUp, MessageSquare, Settings, AlertTriangle,
  Globe, SlidersHorizontal, Users, Search, CalendarOff,
} from "lucide-react"
import MessageTemplates from "./MessageTemplates"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import ChatbotPreview from "./ChatbotPreview"
import { useToast } from "@/components/ui/Toast"
import { logView } from "@/lib/client/log-view"
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
  DEFAULT_FIRST_TIME_MESSAGE_EN,
  DEFAULT_FIRST_TIME_MESSAGE_FIL,
  DEFAULT_OPERATING_DAYS,
  DEFAULT_OPERATING_OPEN_TIME,
  DEFAULT_OPERATING_CLOSE_TIME,
  formatOperatingHours,
  fmtHolidayDate,
  validateChatbotSettings,
  WEEKDAYS,
  type Weekday,
  type Holiday,
} from "@/types/chatbot"

type Tab = "settings" | "knowledge_base" | "message_templates"
type Personality = "friendly" | "formal"

type PendingHolidayAction =
  | { kind: "add"; date: string; label: string }
  | { kind: "edit"; originalDate: string; date: string; label: string }
  | { kind: "remove"; date: string; label: string }

// The master toggles are part of chatbotSettingsSchema now, so ChatbotSettings
// already carries them; the alias is kept for readability at the call sites.
type AdminChatbotSettings = ChatbotSettings

const DEFAULT_SETTINGS: AdminChatbotSettings = {
  enable_ai_chatbot:       true,
  enable_media_validation: true,
  ai_disabled_message:     DEFAULT_AI_DISABLED_MESSAGE,
  personality:             "friendly",
  operating_days:               DEFAULT_OPERATING_DAYS,
  operating_open_time:          DEFAULT_OPERATING_OPEN_TIME,
  operating_close_time:         DEFAULT_OPERATING_CLOSE_TIME,
  holidays:                     [],
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
  first_time_message_en:         DEFAULT_FIRST_TIME_MESSAGE_EN,
  first_time_message_fil:        DEFAULT_FIRST_TIME_MESSAGE_FIL,
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
  // Last saved/loaded copy — what Cancel restores.
  const [savedSettings, setSavedSettings] = useState<AdminChatbotSettings>(DEFAULT_SETTINGS)
  const [settingsDirty, setDirty]     = useState(false)
  const [settingsSaved, setSaved]     = useState(false)
  const [settingsError, setError]     = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [newHolidayDate,  setNewHolidayDate]  = useState("")
  const [newHolidayLabel, setNewHolidayLabel] = useState("")
  const [editingHolidayDate,   setEditingHolidayDate]   = useState<string | null>(null)
  const [editHolidayDateValue, setEditHolidayDateValue] = useState("")
  const [editHolidayLabelValue, setEditHolidayLabelValue] = useState("")
  const [holidayFormError, setHolidayFormError] = useState("")
  const [pendingHoliday,   setPendingHoliday]   = useState<PendingHolidayAction | null>(null)

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
  const [kbSaveConfirmOpen, setKbSaveConfirmOpen] = useState(false)
  const [kbSearch, setKbSearch]               = useState("")
  const [kbCategoryFilter, setKbCategoryFilter] = useState<KBCategory | "All">("All")
  const [openKbCats, setOpenKbCats]           = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/admin/chatbot/config")
      .then((r) => r.json())
      .then(({ config }) => {
        if (config?.settings) {
          const loaded = { ...DEFAULT_SETTINGS, ...config.settings }
          setSettings(loaded)
          setSavedSettings(loaded)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchKnowledge()
  }, [])

  // Another admin adding/editing/removing a knowledge base entry should
  // show up here without a manual reload. Safe to pass fetchKnowledge
  // unmemoized — useRealtimeRefetch holds it in a ref, not an effect dep.
  useRealtimeRefetch("chatbot_knowledge", fetchKnowledge)

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
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      // Compared against the last-saved copy, not just "something changed at
      // some point" — editing a field and then setting it back to its saved
      // value is not a real change, so Save shouldn't light up for it.
      setDirty(JSON.stringify(next) !== JSON.stringify(savedSettings))
      return next
    })
    setSaved(false)
    setError(null)
  }

  function startAddHoliday() {
    const date = newHolidayDate
    const label = newHolidayLabel.trim()
    if (!date || !label) return
    if (settings.holidays.some((h) => h.date === date)) {
      setHolidayFormError("A holiday is already set for that date.")
      return
    }
    setHolidayFormError("")
    setPendingHoliday({ kind: "add", date, label })
  }

  function startEditHoliday(h: Holiday) {
    setEditingHolidayDate(h.date)
    setEditHolidayDateValue(h.date)
    setEditHolidayLabelValue(h.label)
    setHolidayFormError("")
  }

  function cancelEditHoliday() {
    setEditingHolidayDate(null)
    setEditHolidayDateValue("")
    setEditHolidayLabelValue("")
    setHolidayFormError("")
  }

  function confirmEditHoliday(originalDate: string) {
    const date = editHolidayDateValue
    const label = editHolidayLabelValue.trim()
    if (!date || !label) return
    const original = settings.holidays.find((h) => h.date === originalDate)
    if (original && original.date === date && original.label === label) {
      cancelEditHoliday() // nothing actually changed — just close edit mode
      return
    }
    if (settings.holidays.some((h) => h.date === date && h.date !== originalDate)) {
      setHolidayFormError("A holiday is already set for that date.")
      return
    }
    setHolidayFormError("")
    setPendingHoliday({ kind: "edit", originalDate, date, label })
  }

  function startRemoveHoliday(h: Holiday) {
    setPendingHoliday({ kind: "remove", date: h.date, label: h.label })
  }

  function runPendingHoliday() {
    if (!pendingHoliday) return
    if (pendingHoliday.kind === "add") {
      patch("holidays", [...settings.holidays, { date: pendingHoliday.date, label: pendingHoliday.label }])
      setNewHolidayDate("")
      setNewHolidayLabel("")
    } else if (pendingHoliday.kind === "edit") {
      patch("holidays", settings.holidays.map((h) =>
        h.date === pendingHoliday.originalDate ? { date: pendingHoliday.date, label: pendingHoliday.label } : h
      ))
      cancelEditHoliday()
    } else {
      patch("holidays", settings.holidays.filter((h) => h.date !== pendingHoliday.date))
    }
    setPendingHoliday(null)
  }

  const holidayConfirmCopy = pendingHoliday?.kind === "add"
    ? { title: "Add holiday?", message: `Add "${pendingHoliday.label}" on ${fmtHolidayDate(pendingHoliday.date)}?`, confirmLabel: "Add", tone: "primary" as const, icon: CalendarOff }
    : pendingHoliday?.kind === "edit"
      ? { title: "Save changes to this holiday?", message: `Update it to "${pendingHoliday.label}" on ${fmtHolidayDate(pendingHoliday.date)}?`, confirmLabel: "Save", tone: "primary" as const, icon: Pencil }
      : pendingHoliday?.kind === "remove"
        ? { title: "Remove holiday?", message: `Remove "${pendingHoliday.label}" (${fmtHolidayDate(pendingHoliday.date)})?`, confirmLabel: "Remove", tone: "danger" as const, icon: Trash2 }
        : null

  // Same rules the API enforces (types/chatbot.ts) — applies from either tab,
  // since both save the whole settings object.
  const errors = useMemo(() => validateChatbotSettings(settings), [settings])
  const hasErrors = Object.keys(errors).length > 0

  // Warn before a refresh/close silently throws away unsaved edits.
  useEffect(() => {
    if (!settingsDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [settingsDirty])

  function handleCancel() {
    setSettings(savedSettings)
    setDirty(false)
    setSaved(false)
    setError(null)
  }

  function handleSave() {
    if (hasErrors) { setError(Object.values(errors)[0]); return }
    setError(null)
    setSaveConfirmOpen(true)
  }

  async function performSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/chatbot/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      const json = await res.json()
      if (!res.ok) { setSaveConfirmOpen(false); setError(json.error ?? "Failed to save settings."); return }
      setSavedSettings(settings)
      setDirty(false)
      setSaved(true)
      setSaveConfirmOpen(false)
      setTimeout(() => setSaved(false), 2500)
      toast.success("Chatbot settings saved.")
    } catch {
      setSaveConfirmOpen(false)
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // KB helpers
  function openAdd() { setForm(EMPTY_KB_FORM); setEditId(null); setKbError(null); setAddOpen(true) }
  function openEdit(entry: KBEntry) {
    setForm({ category: entry.category, topic: entry.topic, content: entry.content })
    setEditId(entry.id)
    setKbError(null)
    setAddOpen(true)
  }
  function closeForm() { setKbError(null); setAddOpen(false); setEditId(null); setForm(EMPTY_KB_FORM); setKbSaveConfirmOpen(false) }

  function confirmSaveEntry() {
    if (!form.topic.trim() || !form.content.trim() || kbSaving) return
    setKbSaveConfirmOpen(true)
  }

  async function performSaveEntry() {
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
      setKbSaveConfirmOpen(false)
      closeForm()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save entry."
      setKbSaveConfirmOpen(false)
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
      setDeleteConfirmId(null) // close so the error banner behind the overlay is visible
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

  // Grouped by category in canonical order, empty groups dropped. Groups
  // collapse by default (the "organized" look); a group auto-expands while a
  // search term or the category filter is active so results are never hidden.
  const kbGroups = KB_CATEGORIES
    .map((cat) => ({ cat, entries: filteredKbEntries.filter((e) => e.category === cat) }))
    .filter((g) => g.entries.length > 0)
  function toggleKbCat(cat: string) {
    setOpenKbCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-heading">AI Configuration</h1>
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
                label={<><strong className="font-semibold text-heading">Enable AI Chatbot.</strong> Allow the Gemini-powered chatbot to respond to customer messages on Messenger.</>}
              />
              <Toggle
                checked={settings.enable_media_validation}
                onChange={(v) => patch("enable_media_validation", v)}
                label={<><strong className="font-semibold text-heading">Enable AI Media Validation.</strong> Use Gemini to automatically verify that photos or videos uploaded by technicians are relevant to the stage being completed.</>}
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
                    className={`w-full border rounded-card px-4 py-3 text-sm text-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${errors.ai_disabled_message ? "border-status-delayed" : "border-border"}`}
                  />
                  {errors.ai_disabled_message && <p className="text-xs text-status-delayed">{errors.ai_disabled_message}</p>}
                  <p className="text-xs text-muted">
                    Sent once, the first time a customer messages while the AI is off, then the
                    conversation is handed to your Sales team with no further automated replies. Make
                    sure it tells the customer a real person — not the AI — will respond, so they
                    don&apos;t keep expecting an automated answer.
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

          {/* Operating Hours — drives the AI chatbot's answers, the
              "For Release" customer message, and job scheduling's
              working-hours math (see formatOperatingHours in types/chatbot.ts
              and lib/operating-hours.ts, the shared sources every side reads). */}
          <Section icon={<Globe className="w-4 h-4" />} title="Operating Hours" subtitle="When customers can reach you and pick up their vehicle. The chatbot and pickup-ready messages use this directly. Operations job scheduling also uses this to set expected completion times and roll jobs onto the next open day.">
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

              {errors.operating_days && <p className="text-xs text-status-delayed -mt-2">{errors.operating_days}</p>}

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

              {(errors.operating_open_time || errors.operating_close_time) && (
                <p className="text-xs text-status-delayed">{errors.operating_open_time ?? errors.operating_close_time}</p>
              )}

              <div className="border-t border-border-subtle pt-4">
                <p className="text-xs font-medium text-body mb-1">Holidays</p>
                <p className="text-xs text-muted mb-2">
                  Specific dates the shop is closed, in addition to the weekly open days above. These dates are
                  treated as real closed days everywhere, not just in what customers are told.
                </p>

                {settings.holidays.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {[...settings.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h: Holiday) =>
                      editingHolidayDate === h.date ? (
                        <div key={h.date} className="flex flex-wrap items-center gap-2 rounded-sm border border-primary/40 bg-surface px-3 py-1.5">
                          <input
                            type="date"
                            autoFocus
                            value={editHolidayDateValue}
                            onChange={(e) => setEditHolidayDateValue(e.target.value)}
                            className="border border-border rounded-sm px-2 py-1 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <input
                            type="text"
                            value={editHolidayLabelValue}
                            onChange={(e) => setEditHolidayLabelValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") confirmEditHoliday(h.date); if (e.key === "Escape") cancelEditHoliday() }}
                            className="flex-1 min-w-[120px] border border-border rounded-sm px-2 py-1 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <button type="button" onClick={() => confirmEditHoliday(h.date)} title="Save" className="rounded p-1 text-status-inspection hover:bg-status-inspection/10">
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={cancelEditHoliday} title="Cancel" className="rounded p-1 text-muted hover:bg-surface-muted">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          key={h.date}
                          className="flex items-center justify-between gap-2 rounded-sm border border-border bg-surface px-3 py-1.5"
                        >
                          <span className="text-sm text-body">
                            <span className="font-medium">{fmtHolidayDate(h.date)}</span> — {h.label}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEditHoliday(h)}
                              title="Edit holiday"
                              className="p-1 text-muted hover:text-primary transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startRemoveHoliday(h)}
                              title="Remove holiday"
                              className="p-1 text-muted hover:text-status-delayed transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-body">Date</label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => { setNewHolidayDate(e.target.value); setHolidayFormError("") }}
                      className="border border-border rounded-sm px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                    <label className="text-xs font-medium text-body">Label</label>
                    <input
                      type="text"
                      value={newHolidayLabel}
                      onChange={(e) => { setNewHolidayLabel(e.target.value); setHolidayFormError("") }}
                      placeholder="e.g. Christmas Day"
                      className="border border-border rounded-sm px-3 py-2 text-sm text-body bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={startAddHoliday}
                    disabled={!newHolidayDate || !newHolidayLabel.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-body border border-dashed border-border rounded-sm hover:border-primary/40 hover:bg-surface-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CalendarOff className="w-3.5 h-3.5" />
                    Add Holiday
                  </button>
                </div>

                {holidayFormError && <p className="text-xs text-status-delayed mt-1.5">{holidayFormError}</p>}
                {errors.holidays && <p className="text-xs text-status-delayed mt-1.5">{errors.holidays}</p>}
              </div>

              {holidayConfirmCopy && (
                <ConfirmModal
                  open={pendingHoliday !== null}
                  onClose={() => setPendingHoliday(null)}
                  onConfirm={runPendingHoliday}
                  title={holidayConfirmCopy.title}
                  message={holidayConfirmCopy.message}
                  confirmLabel={holidayConfirmCopy.confirmLabel}
                  tone={holidayConfirmCopy.tone}
                  icon={holidayConfirmCopy.icon}
                />
              )}

              <div className="rounded-card bg-surface-muted px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Customers will see</p>
                <p className="text-sm text-body">{formatOperatingHours(settings)}</p>
              </div>
            </div>
          </Section>

          {/* Save */}
          {settingsError && (
            <p className="text-sm text-status-delayed">{settingsError}</p>
          )}
          <div className="flex items-center gap-3 pb-4">
            <button
              onClick={handleSave}
              disabled={!settingsDirty || hasErrors}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-semibold transition-colors ${
                settingsDirty && !hasErrors
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-surface-muted text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
            <button
              onClick={handleCancel}
              disabled={!settingsDirty}
              title="Discard unsaved changes"
              className={`px-5 py-2.5 rounded-card text-sm font-semibold border transition-colors ${
                settingsDirty
                  ? "border-border text-body hover:bg-surface-muted"
                  : "border-border text-muted cursor-not-allowed opacity-60"
              }`}
            >
              Cancel
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
          onCancel={handleCancel}
          saved={settingsSaved}
          dirty={settingsDirty}
          errors={errors}
          error={settingsError}
        />
      )}

      <ConfirmModal
        open={saveConfirmOpen}
        onClose={() => !saving && setSaveConfirmOpen(false)}
        onConfirm={performSave}
        title="Save chatbot settings?"
        message="These settings take effect immediately for every customer conversation with the chatbot."
        confirmLabel={saving ? "Saving…" : "Save"}
        loading={saving}
        icon={Save}
      />

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

          {kbError && !addOpen && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-status-delayed/10 border border-status-delayed/30 rounded-card text-sm text-status-delayed">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {kbError}
            </div>
          )}

          <Modal
            open={addOpen}
            onClose={kbSaving ? undefined : closeForm}
            title={editId ? "Edit Entry" : "New Entry"}
            size="md"
            footer={
              <>
                <Button variant="ghost" onClick={closeForm} disabled={kbSaving}>Cancel</Button>
                <Button onClick={confirmSaveEntry} disabled={!form.topic.trim() || !form.content.trim() || kbSaving}>
                  <Check className="w-3.5 h-3.5" />
                  {kbSaving ? "Saving…" : editId ? "Save Changes" : "Add Entry"}
                </Button>
              </>
            }
          >
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); confirmSaveEntry() }}
            >
              {kbError && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-status-delayed/10 border border-status-delayed/30 rounded-card text-sm text-status-delayed">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {kbError}
                </div>
              )}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-body">Question / Topic</label>
                <input
                  type="text"
                  autoFocus={!editId}
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
                  rows={5}
                  placeholder="Enter the chatbot's response for this topic…"
                  className="border border-border rounded-sm px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </form>
          </Modal>

          <ConfirmModal
            open={kbSaveConfirmOpen}
            onClose={() => !kbSaving && setKbSaveConfirmOpen(false)}
            onConfirm={performSaveEntry}
            title={editId ? "Save changes to this entry?" : "Add this entry?"}
            message={
              editId
                ? `Save changes to "${form.topic.trim()}"?`
                : `Add "${form.topic.trim()}" to the knowledge base?`
            }
            confirmLabel={kbSaving ? "Saving…" : editId ? "Save Changes" : "Add Entry"}
            loading={kbSaving}
            icon={Check}
          />

          <ConfirmModal
            open={deleteConfirmId !== null}
            onClose={() => setDeleteConfirmId(null)}
            onConfirm={() => { if (deleteConfirmId) deleteEntry(deleteConfirmId) }}
            title="Remove this entry?"
            message={
              <>
                <span className="font-medium text-heading">
                  {kbEntries.find((e) => e.id === deleteConfirmId)?.topic}
                </span>
                <br />
                The chatbot will no longer use it to answer customers. This can&apos;t be undone.
              </>
            }
            confirmLabel="Remove"
            tone="danger"
            icon={Trash2}
            loading={kbSaving}
          />

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
            {kbGroups.map((group) => {
              const groupOpen = kbSearchActive || openKbCats.has(group.cat)
              return (
                <div key={group.cat} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleKbCat(group.cat)}
                    className="flex items-center gap-3 px-5 py-3 bg-surface border border-border rounded-card hover:bg-surface-muted/50 transition-colors"
                  >
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${KB_CATEGORY_COLORS[group.cat]}`}>
                      {group.cat}
                    </span>
                    <span className="flex-1 text-left text-sm font-semibold text-heading">
                      {group.cat}
                      <span className="ml-1.5 font-normal text-muted">· {group.entries.length}</span>
                    </span>
                    {groupOpen ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
                  </button>

                  {groupOpen && (
                    <div className="flex flex-col gap-2 pl-3">
                      {group.entries.map((entry) => {
                        const isExpanded = expandedId === entry.id
                        return (
                          <div key={entry.id} className="bg-surface border border-border rounded-card overflow-hidden">
                            <div
                              className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface-muted/50 transition-colors"
                              onClick={() => {
                                const next = isExpanded ? null : entry.id
                                if (next) logView("chatbot_knowledge", entry.topic)
                                setExpandedId(next)
                              }}
                            >
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
                          </div>
                        )
                      })}
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

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
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