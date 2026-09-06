"use client"

import { useEffect, useState } from "react"

export interface CurrentUser {
  user_name: string
  full_name: string
  role: string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operations: "Operations",
  sales: "Sales",
  head_technician: "Head Technician",
  head_detailer: "Head Detailer",
  head_installer: "Head Installer",
}

export function getRoleLabel(role: string) {
  return ROLE_LABELS[role] ?? role
}

export function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    user_name: "",
    full_name: "",
    role: "",
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem("826_user")
      if (raw) setUser(JSON.parse(raw))
    } catch {}
  }, [])

  return user
}
