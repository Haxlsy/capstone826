"use client"

import { createContext, useContext } from "react"
import { useOfflineSync } from "@/hooks/useOfflineSync"

type OfflineSyncValue = ReturnType<typeof useOfflineSync>

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null)

/**
 * Mounts the single shared offline-sync instance (reconnect sync + 5-minute
 * foreground timer) for the whole Operations area, so every consumer (the
 * Settings card, a future status badge, etc.) reads the same state instead
 * of each starting its own competing timer/reconnect listener.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const value = useOfflineSync()
  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>
}

export function useOfflineSyncContext(): OfflineSyncValue {
  const ctx = useContext(OfflineSyncContext)
  if (!ctx) throw new Error("useOfflineSyncContext must be used within OfflineSyncProvider")
  return ctx
}
