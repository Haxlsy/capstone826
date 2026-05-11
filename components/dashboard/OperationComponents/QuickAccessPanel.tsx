"use client"

import { useRouter } from "next/navigation"
import { Sk, SkRow } from "@/components/ui/skeleton"

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
  id:       string
  customer: string
  service:  string
  status:   string
}

interface Props {
  loading:    boolean
  recentJobs: RecentJob[]
}

export default function QuickAccessPanel({ loading, recentJobs }: Props) {
  const router = useRouter()

  const mapped = recentJobs.map((j) => ({
    ...j,
    status: DB_STATUS_LABEL[j.status] ?? j.status,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Recent Job Orders</span>
          <button
            onClick={() => router.push("/dashboard/job-order-records")}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            View All →
          </button>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkRow key={i} className="justify-between py-1">
                  <div className="space-y-1.5">
                    <Sk className="h-3 w-24" />
                    <Sk className="h-4 w-32" />
                  </div>
                  <Sk className="h-5 w-16 rounded-full" />
                </SkRow>
              ))}
            </div>
          ) : mapped.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No job orders yet.</p>
          ) : (
            mapped.map((item, idx) => {
              const badgeClass = STATUS_BADGE[item.status] ?? "bg-gray-100 text-gray-600"
              return (
                <div
                  key={item.id}
                  className={`py-2.5 flex items-center justify-between ${
                    idx < mapped.length - 1 ? "border-b border-gray-50" : ""
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
