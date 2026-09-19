import { createClient } from "@/lib/supabase/client"
import type { RealtimeEnv, WakeReason } from "./supervised-channel"

// Real browser implementation of RealtimeEnv (the supervisor itself stays
// injectable so it can be unit tested).

let heartbeatLogged = false

function logHeartbeatOnce() {
  if (heartbeatLogged) return
  heartbeatLogged = true
  try {
    const rt = createClient().realtime as unknown as {
      onHeartbeat?: (cb: (status: string, latency?: number) => void) => void
    }
    rt.onHeartbeat?.((status, latency) => {
      if (status !== "ok" && status !== "sent") {
        console.warn(`[realtime] heartbeat ${status}`, latency ?? "")
      }
    })
  } catch {
    // diagnostics only
  }
}

export const browserRealtimeEnv: RealtimeEnv = {
  open(topic, bindings, onChange, onStatus) {
    logHeartbeatOnce()
    const supabase = createClient()
    let channel = supabase.channel(topic)
    for (const b of bindings) {
      channel = channel.on(
        "postgres_changes" as never,
        { event: b.event, schema: "public", table: b.table, ...(b.filter ? { filter: b.filter } : {}) } as never,
        () => onChange(),
      )
    }
    channel.subscribe((status, err) => onStatus(status, err))
    return () => {
      void supabase.removeChannel(channel)
    }
  },

  onWake(cb) {
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now()
      } else {
        const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0
        hiddenAt = null
        cb("visible" as WakeReason, hiddenFor)
      }
    }
    const onOnline = () => cb("online" as WakeReason, 0)
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onOnline)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onOnline)
    }
  },

  log(message, err) {
    if (err) console.warn(`[realtime] ${message}`, err)
    else console.warn(`[realtime] ${message}`)
  },
}
