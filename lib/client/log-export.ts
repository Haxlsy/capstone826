"use client"

import type { ExportType } from "@/lib/audit/export-types"

/**
 * Fire-and-forget: tells the audit trail someone exported a PDF/Excel file.
 * Never awaited by callers and never throws into the UI — a failed audit
 * write shouldn't block or flash an error over a successful export. Safe to
 * leave unawaited here since this runs in the browser, not a serverless
 * function, so it isn't exposed to the same silent-drop risk a fire-and-
 * forget write would have server-side.
 */
export function logExport(exportType: ExportType, target?: string): void {
  fetch("/api/audit/log-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exportType, target }),
  }).catch(() => {})
}
