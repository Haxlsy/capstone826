"use client"

import { useRealtimeHealth } from "@/hooks/useRealtimeRefetch"

/** Small Live / Reconnecting indicator for screens where realtime matters. */
export function RealtimeStatusDot({ group }: { group: string }) {
  const status = useRealtimeHealth(group)
  const label = status === "live" ? "Live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"
  const color = status === "live" ? "bg-emerald-500" : status === "reconnecting" ? "bg-amber-500" : "bg-muted-foreground/50"
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      role="status"
      title={status === "live" ? "Updates arrive in real time" : "Live updates paused — catching up when the connection returns"}
    >
      <span className={`h-2 w-2 rounded-full ${color} ${status === "live" ? "" : "animate-pulse"}`} />
      {label}
    </span>
  )
}
