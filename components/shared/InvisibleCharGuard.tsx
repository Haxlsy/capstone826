"use client"

import { useEffect } from "react"
import { cleanValueAndCaret } from "@/lib/text"

// Text-like inputs only. Passwords are never touched (they must be accepted
// exactly as typed), and number/date/checkbox inputs can't hold these anyway.
const TEXT_TYPES = new Set(["text", "email", "search", "tel", "url", ""])

const inputValueSetter = typeof window === "undefined"
  ? undefined
  : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
const textareaValueSetter = typeof window === "undefined"
  ? undefined
  : Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set

/**
 * One app-wide guard that removes invisible characters — like the Hangul
 * filler "ㅤ" (U+3164) used for "blank" names in games — from every text input
 * and textarea as they're typed or pasted, so no form can save a value that
 * looks empty. The server cleans every request body too (readJsonBody); this
 * just makes the field visibly refuse them.
 *
 * Listens in the CAPTURE phase on document, so it runs before React reads the
 * value. The cleaned value is written through the native value setter (not
 * `el.value =`), which keeps React's change tracking seeing a change, so the
 * form's own onChange still fires — with the cleaned value.
 */
export function InvisibleCharGuard() {
  useEffect(() => {
    const onInput = (e: Event) => {
      if ((e as InputEvent).isComposing) return // mid-IME (Korean/Japanese); clean on the next input
      const el = e.target
      let setter: ((v: string) => void) | undefined
      if (el instanceof HTMLInputElement) {
        if (!TEXT_TYPES.has(el.type)) return
        setter = inputValueSetter
      } else if (el instanceof HTMLTextAreaElement) {
        setter = textareaValueSetter
      } else {
        return
      }
      const { value, caret } = cleanValueAndCaret(el.value, el.selectionStart)
      if (value === el.value || !setter) return
      setter.call(el, value)
      if (caret !== null) {
        try {
          el.setSelectionRange(caret, caret)
        } catch {
          // Some input types (email) don't support selection ranges.
        }
      }
    }
    document.addEventListener("input", onInput, true)
    return () => document.removeEventListener("input", onInput, true)
  }, [])

  return null
}
