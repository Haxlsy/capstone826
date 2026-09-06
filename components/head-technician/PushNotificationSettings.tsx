"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, BellOff, Loader2, Send } from "lucide-react"
import { useToast } from "@/components/ui/Toast"
import { getPushStatus, subscribeToPush, type PushStatus } from "@/lib/push/client"

export default function PushNotificationSettings() {
  const toast = useToast()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [enabling, setEnabling] = useState(false)
  const [testing, setTesting] = useState(false)

  async function refresh() {
    setStatus(await getPushStatus())
  }

  useEffect(() => { refresh() }, [])

  async function handleEnable() {
    setEnabling(true)
    const result = await subscribeToPush()
    await refresh()
    setEnabling(false)
    if (!result.ok) {
      toast.error(
        result.permission === "denied"
          ? "Notifications are blocked for this site. Allow them in your browser's site settings, then try again."
          : result.error ?? "Couldn't enable notifications on this device."
      )
    } else {
      toast.success("Push notifications enabled on this device.")
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const res = await fetch("/api/push/test", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to send test notification.")
      toast.success("Test notification sent — check this device.")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send test notification.")
    } finally {
      setTesting(false)
    }
  }

  const enabled = status?.subscribed && status.permission === "granted"
  const blocked = status?.permission === "denied"
  const unsupported = status?.supported === false

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Notifications</p>
          <p className="text-xs text-muted">Get job assignments and rework alerts on this device, even with the browser closed.</p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {status === null ? (
          <p className="text-sm text-muted">Checking status…</p>
        ) : unsupported ? (
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <BellOff className="w-4 h-4 shrink-0" />
            This browser doesn&apos;t support push notifications.
          </div>
        ) : blocked ? (
          <div className="flex items-center gap-2.5 text-sm text-status-delayed">
            <BellOff className="w-4 h-4 shrink-0" />
            Blocked — allow notifications for this site in your browser settings, then reload this page.
          </div>
        ) : enabled ? (
          <div className="flex items-center gap-2.5 text-sm text-status-inspection">
            <BellRing className="w-4 h-4 shrink-0" />
            Enabled on this device.
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-sm text-body">
            <BellOff className="w-4 h-4 shrink-0 text-muted" />
            Not enabled on this device yet.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!enabled && !unsupported && !blocked && (
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-sm hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enabling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              {enabling ? "Enabling…" : "Enable Notifications"}
            </button>
          )}
          {enabled && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 border border-border text-body text-sm font-medium rounded-sm hover:bg-surface-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {testing ? "Sending…" : "Send Test Notification"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
