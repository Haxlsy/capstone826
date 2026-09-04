import { Suspense } from "react"
import AddJobOrderForm from "@/components/dashboard/OperationComponents/AddJobOrderForm"

export default function AddJobOrderPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<div className="text-sm text-muted">Loading…</div>}>
        <AddJobOrderForm />
      </Suspense>
    </div>
  )
}
