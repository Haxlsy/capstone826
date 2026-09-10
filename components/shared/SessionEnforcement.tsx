"use client"

import { useSessionEnforcement } from "@/hooks/useSessionEnforcement"

/** Enforces single active session per account. Renders nothing. */
export function SessionEnforcement() {
  useSessionEnforcement()
  return null
}
