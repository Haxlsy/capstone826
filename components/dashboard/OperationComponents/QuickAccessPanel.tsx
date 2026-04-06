"use client"

import { useState, useEffect } from "react"

const DB_STATUS_LABEL: Record<string, string> = {
  pending:       "Pending",
  ongoing:       "Ongoing",
  quality_check: "Quality Check",
  completed:     "Completed",
  delayed:       "Delayed",
  released:      "Released",
  cancelled:     "Cancelled",
}

const STATUS_BADGE: Record<string, string> = {
  Pending:        "bg-amber-100 text-amber-700",
  Ongoing:        "bg-blue-100 text-blue-700",
  "Quality Check":"bg-orange-100 text-orange-700",
  Completed:      "bg-green-100 text-green-700",
  Delayed:        "bg-red-100 text-red-700",
  Released:       "bg-teal-100 text-teal-700",
  Cancelled:      "bg-gray-100 text-gray-600",
}

interface RecentJob {
  id: string
  customer: string
  status: string
}

export default function QuickAccessPanel() {
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.recent_jobs) {
          setRecentJobs(
            json.recent_jobs.map((j: any) => ({
              id: j.id,
              customer: j.customer,
              status: DB_STATUS_LABEL[j.status] ?? j.status,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-4">
      {/* Section: Recent Job Orders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Recent Job Orders</span>
          <button className="text-xs text-blue-500 hover:text-blue-600 transition-colors">View All →</button>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <p className="text-xs text-gray-400 py-2">Loading…</p>
          ) : recentJobs.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No job orders yet.</p>
          ) : (
            recentJobs.map((item, idx) => {
              const badgeClass = STATUS_BADGE[item.status] ?? "bg-gray-100 text-gray-600"
              return (
                <div
                  key={item.id}
                  className={`py-2.5 flex items-center justify-between ${
                    idx < recentJobs.length - 1 ? "border-b border-gray-50" : ""
                  }`}
                >
                  <div>
                    <p className="text-xs text-gray-500 font-mono">{item.id}</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{item.customer}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badgeClass}`}>
                    {item.status}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
