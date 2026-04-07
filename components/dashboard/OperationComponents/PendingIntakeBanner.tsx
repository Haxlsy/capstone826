"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Inbox, ArrowRight } from "lucide-react"

export default function PendingIntakeBanner() {
  const router = useRouter()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/operations/dashboard")
      .then((r) => r.json())
      .then((json) => setCount(json.pending_intakes_count ?? 0))
      .catch(() => setCount(0))
  }, [])

  return (
    <div className="bg-white rounded-xl border-2 border-amber-400 p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
        <Inbox className="w-6 h-6 text-amber-500" />
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-800">
            {count === null ? "—" : count}
          </span>
          <span className="text-sm font-semibold text-gray-700">Pending Intake Records</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Confirmed bookings from Sales awaiting job order creation.</p>
      </div>
      <button
        onClick={() => router.push("/dashboard/customer-intake-records")}
        className="flex items-center gap-1 text-sm font-medium text-amber-500 hover:text-amber-600 transition-colors shrink-0"
      >
        View All <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
