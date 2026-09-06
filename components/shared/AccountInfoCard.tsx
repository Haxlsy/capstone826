"use client"

import { useEffect, useState } from "react"
import { User } from "lucide-react"
import { getInitials, getRoleLabel } from "@/hooks/useCurrentUser"

interface Profile {
  full_name: string
  username: string
  role: string
  created_at: string
}

export default function AccountInfoCard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json.user) setProfile(json.user) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden mb-5">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <div className="w-8 h-8 rounded-sm bg-primary/10 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Account Info</p>
          <p className="text-xs text-muted">Your account details.</p>
        </div>
      </div>

      <div className="px-6 py-5">
        {loading ? (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-surface-muted shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-32 bg-surface-muted rounded-sm" />
              <div className="h-3 w-24 bg-surface-muted rounded-sm" />
            </div>
          </div>
        ) : profile ? (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/12 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <InfoRow label="Full Name" value={profile.full_name} />
              <InfoRow label="Role" value={getRoleLabel(profile.role)} />
              <InfoRow label="Username" value={profile.username} mono />
              <InfoRow
                label="Member Since"
                value={new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">Couldn&apos;t load account info.</p>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-muted uppercase tracking-wide mb-0.5">{label}</p>
      <p className={mono ? "font-mono text-xs text-heading" : "text-sm font-medium text-heading"}>{value}</p>
    </div>
  )
}
