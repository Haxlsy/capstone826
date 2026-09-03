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
      <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Account Not Linked Message</p>
          <p className="text-xs text-gray-400 mt-0.5">What a customer sees when they ask for vehicle status and we can&apos;t identify them yet.</p>
        </div>

        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            Vehicle status is resolved automatically from the customer&apos;s linked Messenger account — the system finds their active job order and sends the status itself, without asking the AI to look anything up. If their account isn&apos;t linked yet, the system asks for their plate number and booking phone, then passes the request to Sales to verify.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Information read from the customer&apos;s reply</p>
          <div className="grid grid-cols-2 gap-2 max-w-sm">
            {["Plate Number", "Contact Number"].map((f) => (
              <div key={f} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                <span className="text-sm text-gray-600">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Template editor + preview */}
      <div className="flex gap-6">
        {/* Editor — left */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            Sent word for word when someone asks for their vehicle status and their Messenger account
            isn&apos;t linked to a customer record yet. The AI never rewrites it.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Keep asking for their <strong>plate number</strong> and <strong>phone number</strong> — the next message they send is read as those two.</li>
              <li>Don&apos;t say we&apos;ve already checked or looked anything up. At this point we haven&apos;t, because we can&apos;t tell who they are yet.</li>
              <li>Write it in whichever language you want customers to see — it is sent exactly as typed, with no translation.</li>
              <li>Leave it empty and the built-in default message is used instead.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={16}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400">{value.length} characters</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onSave}
              disabled={!saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                saving
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Template
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Messenger Preview — right */}
        <div className="w-72 flex flex-col gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Messenger Preview</p>
          </div>

          <div className="bg-gray-100 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                826
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">826 Auto Care</p>
                <p className="text-[10px] text-gray-400">Typically replies instantly</p>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                826
              </div>
              <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm max-w-[85%]">
                <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {value || "Your template will appear here…"}
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="bg-blue-500 rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%]">
                <p className="text-[11px] text-white">Sure! Here are my details…</p>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center">Preview approximates Messenger layout.</p>
        </div>
      </div>
    </div>
  )
}
