"use client"

import { useState } from "react"
import { Bot, BookOpen, Save, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react"

type Tab = "instructions" | "knowledge_base"

type KBCategory = "Service" | "Pricing" | "Hours" | "FAQ" | "Other"

interface KBEntry {
  id: string
  category: KBCategory
  question: string
  answer: string
}

const CATEGORY_COLORS: Record<KBCategory, string> = {
  Service:  "bg-blue-50 text-blue-600 border-blue-200",
  Pricing:  "bg-green-50 text-green-600 border-green-200",
  Hours:    "bg-orange-50 text-orange-600 border-orange-200",
  FAQ:      "bg-purple-50 text-purple-600 border-purple-200",
  Other:    "bg-gray-100 text-gray-500 border-gray-200",
}

const MOCK_INSTRUCTIONS = `You are the official AI assistant for 826 Auto Care OPC, a vehicle detailing and installation shop. You are friendly, professional, and concise.

You can help customers with:
- Information about our services and pricing
- Business hours and location
- General detailing and installation FAQs
- Checking their vehicle's current service status (using plate number and contact number)

When a customer wants to book a service:
1. Collect their full name, contact number, plate number, and vehicle unit.
2. Confirm the details with the customer.
3. Let them know that a Sales representative will reach out to confirm the booking.

If you cannot answer a question, or if the customer requests to speak with a human, escalate the conversation immediately.

Never provide information outside the scope of 826 Auto Care's services.`

const MOCK_KB: KBEntry[] = [
  {
    id: "1",
    category: "Service",
    question: "What services do you offer?",
    answer: "We offer full car detailing, ceramic coating, PPF (Paint Protection Film), window tinting, and dash cam installation.",
  },
  {
    id: "2",
    category: "Pricing",
    question: "How much does ceramic coating cost?",
    answer: "Ceramic coating starts at ₱15,000 for sedans and ₱18,000 for SUVs. Final pricing depends on vehicle size and condition.",
  },
  {
    id: "3",
    category: "Hours",
    question: "What are your business hours?",
    answer: "We are open Monday to Saturday, 8:00 AM to 6:00 PM. We are closed on Sundays and public holidays.",
  },
  {
    id: "4",
    category: "FAQ",
    question: "How long does a full detail take?",
    answer: "A full detail typically takes 1–2 days depending on the service and vehicle condition.",
  },
]

const EMPTY_KB_FORM = {
  category: "FAQ" as KBCategory,
  question: "",
  answer: "",
}

export default function ChatbotManagement() {
  const [activeTab, setActiveTab] = useState<Tab>("instructions")

  // Instructions state
  const [instructions, setInstructions] = useState(MOCK_INSTRUCTIONS)
  const [instructionsDirty, setInstructionsDirty] = useState(false)
  const [instructionsSaved, setInstructionsSaved] = useState(false)

  // Knowledge base state
  const [kbEntries, setKbEntries] = useState<KBEntry[]>(MOCK_KB)
  const [addOpen, setAddOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_KB_FORM)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  function handleInstructionsChange(val: string) {
    setInstructions(val)
    setInstructionsDirty(true)
    setInstructionsSaved(false)
  }

  function handleSaveInstructions() {
    // TODO: POST to /api/admin/chatbot/instructions
    setInstructionsDirty(false)
    setInstructionsSaved(true)
    setTimeout(() => setInstructionsSaved(false), 2500)
  }

  function openAdd() {
    setForm(EMPTY_KB_FORM)
    setEditId(null)
    setAddOpen(true)
  }

  function openEdit(entry: KBEntry) {
    setForm({ category: entry.category, question: entry.question, answer: entry.answer })
    setEditId(entry.id)
    setAddOpen(true)
  }

  function closeForm() {
    setAddOpen(false)
    setEditId(null)
    setForm(EMPTY_KB_FORM)
  }

  function saveEntry() {
    if (!form.question.trim() || !form.answer.trim()) return
    if (editId) {
      setKbEntries((prev) =>
        prev.map((e) => (e.id === editId ? { ...e, ...form } : e))
      )
    } else {
      setKbEntries((prev) => [
        ...prev,
        { id: String(Date.now()), ...form },
      ])
    }
    closeForm()
  }

  function deleteEntry(id: string) {
    setKbEntries((prev) => prev.filter((e) => e.id !== id))
    setDeleteConfirmId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">AI Chatbot Management</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Configure the chatbot's instructions and knowledge base.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        <TabButton
          active={activeTab === "instructions"}
          onClick={() => setActiveTab("instructions")}
          icon={<Bot className="w-4 h-4" />}
          label="Chatbot Instructions"
        />
        <TabButton
          active={activeTab === "knowledge_base"}
          onClick={() => setActiveTab("knowledge_base")}
          icon={<BookOpen className="w-4 h-4" />}
          label="Knowledge Base"
        />
      </div>

      {/* Instructions Tab */}
      {activeTab === "instructions" && (
        <div className="flex flex-col gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            This is the system prompt sent to the AI for every customer conversation. It controls the chatbot's tone, scope, and behavior.
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">System Prompt</label>
            <textarea
              value={instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              rows={18}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400">{instructions.length} characters</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveInstructions}
              disabled={!instructionsDirty}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                instructionsDirty
                  ? "bg-gray-900 text-white hover:bg-gray-800"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              Save Instructions
            </button>
            {instructionsSaved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
          </div>
        </div>
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

          {/* Add / Edit Form */}
          {addOpen && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">
                  {editId ? "Edit Entry" : "New Entry"}
                </p>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as KBCategory }))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(["Service", "Pricing", "Hours", "FAQ", "Other"] as KBCategory[]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Question / Topic</label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  placeholder="e.g., What are your business hours?"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">Answer</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  rows={4}
                  placeholder="Enter the chatbot's response for this topic…"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={saveEntry}
                  disabled={!form.question.trim() || !form.answer.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  {editId ? "Save Changes" : "Add Entry"}
                </button>
                <button
                  onClick={closeForm}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Entry List */}
          <div className="flex flex-col gap-2">
            {kbEntries.length === 0 && (
              <div className="text-center py-10 text-sm text-gray-400">
                No knowledge base entries yet. Add one above.
              </div>
            )}
            {kbEntries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const isDeleteConfirm = deleteConfirmId === entry.id
              return (
                <div
                  key={entry.id}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50/50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${CATEGORY_COLORS[entry.category]}`}
                    >
                      {entry.category}
                    </span>
                    <p className="flex-1 text-sm font-medium text-gray-800 truncate">
                      {entry.question}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(entry) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(entry.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-4 pt-0 border-t border-gray-100">
                      <p className="text-sm text-gray-600 leading-relaxed mt-3">{entry.answer}</p>
                    </div>
                  )}

                  {isDeleteConfirm && (
                    <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                      <p className="text-sm text-red-600">Remove this entry?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-white transition-colors"
                        >
                          Cancel
                        </button>
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

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-gray-900 text-gray-900"
          : "border-transparent text-gray-400 hover:text-gray-600"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
