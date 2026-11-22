import JobOrderRecords from "@/components/dashboard/OperationComponents/JobOrderRecords"
import { getJobOrdersData } from "@/lib/operations/job-orders-data"

export default async function JobOrderRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ expiring?: string }>
}) {
  const [data, params] = await Promise.all([getJobOrdersData(true), searchParams])
  return (
    <div className="p-4 md:p-6">
      {/* ?expiring=1 comes from the weekly data-retention notice. */}
      <JobOrderRecords jobOrders={data.job_orders} initialExpiring={params.expiring === "1"} />
    </div>
  )
}
