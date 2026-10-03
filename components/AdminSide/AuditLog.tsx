"use client"
import {useState} from "react"

import UserActivity from "./Security&AuditCenter/UserActivity"
import Security from "./Security&AuditCenter/Security"
type Tab = "security" | "audit"

export default function AuditLog() {
  const [activeTab, setActiveTab] = useState<Tab>("audit");
  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-border">
        <button
          className={`py-2 px-4 text-sm font-medium ${activeTab === "audit" ? "text-primary border-b-2 border-primary" : "text-body hover:text-body"}`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Trails
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${activeTab === "security" ? "text-primary border-b-2 border-primary" : "text-body hover:text-body"}`}
          onClick={() => setActiveTab("security")}
        >
          Security Logs
        </button>
      </div>

      <div className="bg-surface rounded-card border border-border-subtle">
        {activeTab === 'audit' ? <UserActivity/> :<Security/>}
      </div>
    </div>
  )
}
