"use client"

import { useState } from "react"
import { Save, Check, Smartphone } from "lucide-react"

const DEFAULT_TEMPLATE = `Hello! Thank you for reaching out to 826 Auto Care. 🚗

To check the status of your vehicle, please provide the following details:

1. Full Name: [Your Full Name]
2. Plate Number: [e.g., ABC-1234]
3. Contact Number: [e.g., 09XX-XXX-XXXX]
4. Email Address: [Your Email]

Once we have your information, we'll look up your vehicle's current service status right away!`

export default function VehicleStatusTemplate() {
  const [template, setTemplate]   = useState(DEFAULT_TEMPLATE)
  const [dirty, setDirty]         = useState(false)
  const [saved, setSaved]         = useState(false)

  function handleChange(val: string) {
    setTemplate(val)
    setDirty(true)
    setSaved(false)
  }

  function handleSave() {
    // TODO: POST to /api/admin/chatbot/vehicle-template
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="flex gap-6">
      {/* Editor — left */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          This message is sent by the chatbot when a customer requests their vehicle&apos;s service status.
          Customize the wording, but keep the four required fields: Full Name, Plate Number, Contact Number, and Email.
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Template Message</label>
          <textarea
            value={template}
            onChange={(e) => handleChange(e.target.value)}
            rows={16}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p className="text-xs text-gray-400">{template.length} characters</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              dirty
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
          {/* Fake messenger header */}
          <div className="flex items-center gap-2.5 pb-3 border-b border-gray-200">
            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
              826
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">826 Auto Care</p>
              <p className="text-[10px] text-gray-400">Typically replies instantly</p>
            </div>
          </div>

          {/* Bot bubble */}
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
              826
            </div>
            <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2.5 shadow-sm max-w-[85%]">
              <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                {template || "Your template will appear here…"}
              </p>
            </div>
          </div>

          {/* Fake customer reply */}
          <div className="flex justify-end">
            <div className="bg-blue-500 rounded-2xl rounded-br-sm px-3 py-2 max-w-[75%]">
              <p className="text-[11px] text-white">Sure! Here are my details…</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center">Preview approximates Messenger layout.</p>
      </div>
    </div>
  )
}
