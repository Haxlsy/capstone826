"use client"

import { useState } from "react"
import { X } from "lucide-react"

interface TagInputProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  autoFocus?: boolean
}

/**
 * Comma/Enter-delimited chip input — types a phrase, commits it as a
 * removable tag. Pasting text with commas splits it into multiple tags at
 * once. The value/onChange shape is a plain string[]; callers that need a
 * single stored string (e.g. a DB column that isn't an array) join/split it
 * themselves at the edges.
 */
export function TagInput({ value, onChange, placeholder, autoFocus }: TagInputProps) {
  const [draft, setDraft] = useState("")

  function commit(raw: string) {
    const tag = raw.trim()
    if (!tag) return
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return
    onChange([...value, tag])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault()
      commit(draft)
      setDraft("")
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text")
    if (!text.includes(",")) return
    e.preventDefault()
    text.split(",").forEach(commit)
    setDraft("")
  }

  function handleBlur() {
    if (draft.trim()) {
      commit(draft)
      setDraft("")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border border-border rounded-sm px-3 py-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/30">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-1"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="hover:text-status-delayed"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        autoFocus={autoFocus}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none text-sm text-body bg-transparent"
      />
    </div>
  )
}
