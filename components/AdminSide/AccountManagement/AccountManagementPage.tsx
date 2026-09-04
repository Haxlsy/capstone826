"use client"

import { useEffect, useState } from "react"
import { Tabs } from "@/components/ui/Tabs"
import { Badge } from "@/components/ui/Badge"
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
    <div className="flex h-full flex-col">
      <div className="shrink-0 bg-surface px-6 pt-5">
        <Tabs
          items={[
            { key: "staff", label: "Staff Accounts" },
            {
              key: "admins",
              label: (
                <span className="flex items-center gap-2">
                  Admin Accounts
                  <Badge className="bg-status-concern/12 text-[10px] font-bold text-status-concern">
                    Super Admin
                  </Badge>
                </span>
              ),
            },
          ]}
          value={activeTab}
          onChange={(k) => setActiveTab(k as Tab)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "staff" ? <AccountTable /> : <AdminAccountTable />}
      </div>
    </div>
  )
}
