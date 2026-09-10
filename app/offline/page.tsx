"use client"

import { WifiOff } from "lucide-react"

// Precached fallback shown when a page can't be reached offline (see
// public/sw.js — precached on install, served for any failed navigation).
// No server data / cookies() so it stays statically prerendered.

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-subtle px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-status-delayed/10 text-status-delayed">
        <WifiOff className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold text-heading">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-body">
        This page needs a connection. Anything you already queued (a new job order, a resolved
        concern) is saved and will sync automatically once you&apos;re back online.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => location.reload()}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Try again
        </button>
        <a
          href="/dashboard/operations"
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-body transition-colors hover:bg-surface-muted"
        >
          Go to dashboard
        </a>
      </div>
    </div>
  )
}
