"use client"

import { useRouter } from "next/navigation"
import { Card, CardBody } from "@/components/ui/Card"
import { StatusBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Sk, SkRow } from "@/components/ui/skeleton"

const DB_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ongoing: "Ongoing",
  quality_check: "Quality Check",
  completed: "Completed",
  delayed: "Delayed",
  released: "Completed",
  Released: "Completed",
  cancelled: "Cancelled",
}

interface RecentJob {
  id: string
  display_id: string
  customer: string
  service: string
  status: string
}

interface Props {
  loading: boolean
  recentJobs: RecentJob[]
}

export default function QuickAccessPanel({ loading, recentJobs }: Props) {
  const router = useRouter()

  const mapped = recentJobs.map((j) => ({
    ...j,
    status: DB_STATUS_LABEL[j.status] ?? j.status,
  }))

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-heading">Recent Job Orders</span>
          <button
            onClick={() => router.push("/dashboard/job-order-records")}
            className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
          >
            View All →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
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
          <EmptyState title="No Recent Job Orders" compact />
        ) : (
          <div className="flex flex-col">
            {mapped.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between py-2.5 ${
                  idx < mapped.length - 1 ? "border-b border-border-subtle" : ""
                }`}
              >
                <div>
                  <p className="font-mono text-xs text-body">{item.display_id}</p>
                  <p className="mt-0.5 text-sm font-medium text-heading">{item.customer}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
