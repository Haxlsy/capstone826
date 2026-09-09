"use client"

import { useState } from "react"
import { Save, Check, Smartphone, Info, AlertTriangle } from "lucide-react"
import type { ChatbotSettings } from "@/types/chatbot"

type TemplateField =
  | "vehicle_status_message_en" | "vehicle_status_message_fil"
  | "link_verification_message_en" | "link_verification_message_fil"
  | "escalation_message_en" | "escalation_message_fil"
  | "resolved_message_en" | "resolved_message_fil"
  | "booking_message_en" | "booking_message_fil"

interface Category {
  key: string
  label: string
  enField: TemplateField
  filField: TemplateField
  description: string
}

const CATEGORIES: Category[] = [
  {
    key: "vehicle_status",
    label: "Vehicle Status",
    enField: "vehicle_status_message_en",
    filField: "vehicle_status_message_fil",
    description:
      "Sent when a customer asks for their vehicle's status but their Messenger account isn't linked to a customer record yet. It asks them for their Job Order ID so the system can link their account automatically.",
  },
  {
    key: "link_verification",
    label: "Link Verification",
    enField: "link_verification_message_en",
    filField: "link_verification_message_fil",
    description:
      "Sent when a customer's Job Order ID can't be verified — either it doesn't match any job order on file, or it's already linked to a different Messenger account. The same message covers both cases on purpose, so a stranger can't use the reply to guess which codes are valid.",
  },
  {
    key: "human_escalation",
    label: "Human Escalation",
    enField: "escalation_message_en",
    filField: "escalation_message_fil",
    description:
      "Sent whenever the chatbot hands the conversation to your team — e.g. the customer asks to speak with someone, reports a concern, or their booking details are complete and ready for Sales. A short, specific reason is automatically added in front of this message when it's safe to share.",
  },
  {
    key: "resolved",
    label: "Resolved",
    enField: "resolved_message_en",
    filField: "resolved_message_fil",
    description:
      "Sent when a staff member finishes helping a customer and the chatbot takes back over. It's shown together with the regular menu of options.",
  },
  {
    key: "booking_confirmation",
    label: "Booking Request Confirmation",
    enField: "booking_message_en",
    filField: "booking_message_fil",
    description:
      "Sent right after the chatbot finishes collecting a customer's booking details (name, contact number, plate number, vehicle, email), before handing the request to Sales.",
  },
]

interface Props {
  settings: ChatbotSettings
  patch: (key: TemplateField, value: string) => void
  onSave: () => void
  saved: boolean
  saving: boolean
}

export default function MessageTemplates({ settings, patch, onSave, saved, saving }: Props) {
  const [activeKey, setActiveKey] = useState(CATEGORIES[0].key)
  const [previewLang, setPreviewLang] = useState<"en" | "fil">("en")

  const active = CATEGORIES.find((c) => c.key === activeKey) ?? CATEGORIES[0]
  const enValue = settings[active.enField] ?? ""
  const filValue = settings[active.filField] ?? ""

  const incomplete = CATEGORIES.filter(
    (c) => !(settings[c.enField] ?? "").trim() || !(settings[c.filField] ?? "").trim(),
  )
  const hasIncomplete = incomplete.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Category selector */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const isMissing = !(settings[c.enField] ?? "").trim() || !(settings[c.filField] ?? "").trim()
          return (
            <button
              key={c.key}
              onClick={() => setActiveKey(c.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-card text-sm font-medium border transition-colors ${
                activeKey === c.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-body border-border hover:border-primary/40"
              }`}
            >
              {c.label}
              {isMissing && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${activeKey === c.key ? "bg-white" : "bg-status-warning"}`}
                  title="Missing English or Filipino message"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Explanation */}
      <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-3">
        <p className="text-sm font-semibold text-heading">{active.label} Template</p>
        <div className="flex items-start gap-2.5 bg-primary/10 border border-primary/20 rounded-card px-4 py-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary">{active.description}</p>
        </div>
      </div>

      {/* Editor + preview */}
      <div className="flex gap-6 items-start">
        {/* Editor — left */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-body">
              English Message <span className="text-status-delayed">*</span>
            </label>
            <textarea
              value={enValue}
              onChange={(e) => patch(active.enField, e.target.value)}
              rows={8}
              className="w-full border border-border rounded-card px-4 py-3 text-sm text-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-muted">{enValue.length} characters</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-body">
              Filipino Message <span className="text-status-delayed">*</span>
            </label>
            <textarea
              value={filValue}
              onChange={(e) => patch(active.filField, e.target.value)}
              rows={8}
              className="w-full border border-border rounded-card px-4 py-3 text-sm text-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-muted">{filValue.length} characters</p>
          </div>

          {hasIncomplete && (
            <div className="flex items-start gap-2.5 bg-status-warning/10 border border-status-warning/30 rounded-card px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-status-warning mt-0.5 shrink-0" />
              <p className="text-sm text-status-warning">
                Both English and Filipino are required for every template. Still missing: {incomplete.map((c) => c.label).join(", ")}.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={!saving || hasIncomplete}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-semibold transition-colors ${
                saving && !hasIncomplete
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-surface-muted text-muted cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-status-inspection">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Messenger Preview — right */}
        <div className="w-72 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-muted" />
              <p className="text-sm font-medium text-body">Messenger Preview</p>
            </div>
            <div className="flex gap-1 rounded-pill bg-surface-muted p-0.5">
              {(["en", "fil"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setPreviewLang(l)}
                  className={`px-2.5 py-1 rounded-pill text-[11px] font-semibold transition-colors ${
                    previewLang === l ? "bg-primary text-white" : "text-muted hover:text-body"
                  }`}
                >
                  {l === "en" ? "EN" : "FIL"}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-muted rounded-card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                826
              </div>
              <div>
                <p className="text-xs font-semibold text-heading">826 Auto Care</p>
                <p className="text-[10px] text-muted">Typically replies instantly</p>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                826
              </div>
              <div className="bg-surface rounded-card rounded-bl-sm px-3 py-2.5 shadow-sm max-w-[85%]">
                <p className="text-[11px] text-body leading-relaxed whitespace-pre-wrap">
                  {(previewLang === "en" ? enValue : filValue) || "Your template will appear here…"}
                </p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted text-center">Preview approximates Messenger layout.</p>
        </div>
      </div>
    </div>
  )
}
