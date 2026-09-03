"use client"

import { useEffect, useState } from "react"
import { Shield, Users } from "lucide-react"
import AccountTable from "./AccountTable"
import AdminAccountTable from "./AdminAccountTable"

type Tab = "staff" | "admins"

export default function AccountManagementPage() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("staff")

  useEffect(() => {
    try {
      const raw = localStorage.getItem("826_user")
      if (raw) {
        const user = JSON.parse(raw)
        if (user.role === "super_admin") setIsSuperAdmin(true)
      }
    } catch {}
  }, [])

  if (!isSuperAdmin) {
    return <AccountTable />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border px-6 pt-5 gap-1 shrink-0 bg-surface">
        <TabButton
          active={activeTab === "staff"}
          onClick={() => setActiveTab("staff")}
          icon={<Users className="w-4 h-4" />}
          label="Staff Accounts"
        />
        <TabButton
          active={activeTab === "admins"}
          onClick={() => setActiveTab("admins")}
          icon={<Shield className="w-4 h-4" />}
          label="Admin Accounts"
          badge
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "staff" ? <AccountTable /> : <AdminAccountTable />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-heading"
          : "border-transparent text-muted hover:text-body"
      }`}
    >
      {icon}
      {label}
      {badge && (
        <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-status-concern/12 text-status-concern">
          Super Admin
        </span>
      )}
    </button>
  )
}
