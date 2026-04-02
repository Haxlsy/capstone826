import { Suspense } from "react"
import AddJobOrderForm from "@/components/dashboard/OperationComponents/AddJobOrderForm"

export default function AddJobOrderPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <Suspense fallback={<div className="text-sm text-gray-400">Loading…</div>}>
        <AddJobOrderForm />
      </Suspense>
    </div>
  )
}
