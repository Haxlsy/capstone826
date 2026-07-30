import JobOrderRecords from "@/components/dashboard/OperationComponents/JobOrderRecords"
import { getJobOrdersData } from "@/lib/operations/job-orders-data"

export default async function JobOrderRecordsPage() {
  const data = await getJobOrdersData(true)
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <JobOrderRecords jobOrders={data.job_orders} />
    </div>
  )
}
