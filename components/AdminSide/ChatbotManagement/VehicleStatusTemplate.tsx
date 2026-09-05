"use client"

import { Save, Check, Smartphone, Info } from "lucide-react"

interface Props {
  value:    string
  onChange: (v: string) => void
  onSave:   () => void
  saved:    boolean
  saving:   boolean
}

export default function VehicleStatusTemplate({ value, onChange, onSave, saved, saving }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Vehicle Status Setup */}
      <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-heading">Account Not Linked Message</p>
          <p className="text-xs text-muted mt-0.5">What a customer sees when they ask for vehicle status and we can&apos;t identify them yet.</p>
        </div>

        <div className="flex items-start gap-2.5 bg-primary/10 border border-primary/20 rounded-card px-4 py-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-primary">
            Vehicle status is resolved automatically from the customer&apos;s linked Messenger account — the system finds their active job order and sends the status itself, without asking the AI to look anything up. If their account isn&apos;t linked yet, the system asks for their Job Order Code and links the account automatically once it recognizes it — no Sales verification step needed.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-body">Information read from the customer&apos;s reply</p>
          <div className="grid grid-cols-1 gap-2 max-w-[180px]">
            {["Job Order Code"].map((f) => (
              <div key={f} className="flex items-center gap-2 px-3 py-2 bg-surface-subtle rounded-sm border border-border">
                <Check className="w-3.5 h-3.5 text-status-inspection shrink-0" />
                <span className="text-sm text-body">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template editor + preview */}
      <div className="flex gap-6">
        {/* Editor — left */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-body">Message</label>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={16}
              className="w-full border border-border rounded-card px-4 py-3 text-sm text-body leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
            <p className="text-xs text-muted">{value.length} characters</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={!saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-card text-sm font-semibold transition-colors ${
                saving
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
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted" />
            <p className="text-sm font-medium text-body">Messenger Preview</p>
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
                  {value || "Your template will appear here…"}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="bg-primary rounded-card rounded-br-sm px-3 py-2 max-w-[75%]">
                <p className="text-[11px] text-white">Sure! Here are my details…</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted text-center">Preview approximates Messenger layout.</p>
        </div>
      </div>
    </div>
  )
}
