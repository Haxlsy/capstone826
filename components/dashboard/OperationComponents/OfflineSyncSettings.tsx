"use client"

import { CloudOff, CloudUpload, Loader2, RefreshCw } from "lucide-react"
import { useOfflineSyncContext } from "@/components/dashboard/OperationComponents/OfflineSyncContext"

/**
 * Mirrors components/head-technician/PushNotificationSettings.tsx's card
 * pattern. See docs/plan/operations-offline-mode-plan.md — Add Job Order and
 * Resolve Concern queue locally while offline and sync automatically.
 */
export default function OfflineSyncSettings() {
  const { pendingCount, failedCount, syncing, isOnline, syncNow } = useOfflineSyncContext()
  const hasQueue = pendingCount > 0 || failedCount > 0

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Backup Sync</p>
          <p className="text-xs text-muted">
            Add Job Order and Resolve Concern keep working offline — changes save locally and
            sync automatically every 5 minutes while this page is open, and immediately once
            you&apos;re back online.
          </p>
        </div>
      </div>

      <div className="px-6 py-5 space-y-4">
        {!hasQueue ? (
          <div className="flex items-center gap-2.5 text-sm text-status-inspection">
            <CloudUpload className="w-4 h-4 shrink-0" />
            All changes synced.
          </div>
        ) : (
          <div className="space-y-1.5">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2.5 text-sm text-body">
                <CloudOff className="w-4 h-4 shrink-0 text-muted" />
                {pendingCount} change{pendingCount !== 1 ? "s" : ""} waiting to sync.
              </div>
            )}
            {failedCount > 0 && (
              <div className="flex items-center gap-2.5 text-sm text-status-delayed">
                <CloudOff className="w-4 h-4 shrink-0" />
                {failedCount} change{failedCount !== 1 ? "s" : ""} couldn&apos;t sync — open
                Job Management or Concerns to check what changed, then retry.
              </div>
            )}
          </div>
        )}

        {hasQueue && (
          <button
            onClick={syncNow}
            disabled={syncing || !isOnline}
            title={!isOnline ? "You're offline — reconnect to sync." : undefined}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-sm hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        )}
      </div>
    </div>
  )
}
