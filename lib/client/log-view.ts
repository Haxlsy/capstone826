"use client"

import type { ViewType } from "@/lib/audit/view-types"

/**
 * Fire-and-forget: tells the audit trail someone opened a sensitive record's
 * details. Never awaited by callers and never throws into the UI — a failed
 * audit write shouldn't block or flash an error over someone just viewing a
 * record.
 */
export function logView(viewType: ViewType, target?: string): void {
  fetch("/api/audit/log-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewType, target }),
  }).catch(() => {})
}
