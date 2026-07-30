"use client"
import {useState} from "react"

import UserActivity from "./Security&AuditCenter/UserActivity"
import Security from "./Security&AuditCenter/Security"
type Tab = "security" | "audit"

export default function AuditLog({ initialLogs }: { initialLogs: any[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("audit");
  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`py-2 px-4 text-sm font-medium ${activeTab === "audit" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Trails
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${activeTab === "security" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          onClick={() => setActiveTab("security")}
        >
          Security Logs
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {activeTab === 'audit' ? <UserActivity initialLogs={initialLogs}/> :<Security initialLogs={initialLogs}/>}
      </div>
    </div>
  )
}
