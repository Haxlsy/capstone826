"use client"

import { useEffect, useState } from "react"
import type { RetentionPolicy } from "@/lib/retention/plan"

/**
 * The data-retention policy from /api/retention, fetched once per page load
 * and shared by every component that asks (archive dialogs, badges, filters,
 * Settings). Null until loaded, or if it can't be loaded; callers fall back
 * to the default wording.
 */
let cached: Promise<RetentionPolicy | null> | null = null
const listeners = new Set<(p: RetentionPolicy | null) => void>()

function load(force = false): Promise<RetentionPolicy | null> {
  if (!cached || force) {
    cached = fetch("/api/retention")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d && typeof d.months === "number" ? { months: d.months, changedAt: d.changedAt ?? null } : null))
      .catch(() => null)
    cached.then((p) => listeners.forEach((l) => l(p)))
  }
  return cached
}

/** Re-reads the policy everywhere, e.g. after an Admin changes the period. */
export function refreshRetentionPolicy(): void {
  void load(true)
}

export function useRetentionPolicy(): RetentionPolicy | null {
  const [policy, setPolicy] = useState<RetentionPolicy | null>(null)
  useEffect(() => {
    let alive = true
    const listener = (p: RetentionPolicy | null) => { if (alive) setPolicy(p) }
    listeners.add(listener)
    load().then(listener)
    return () => { alive = false; listeners.delete(listener) }
  }, [])
  return policy
}
