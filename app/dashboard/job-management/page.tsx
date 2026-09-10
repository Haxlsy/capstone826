import JobManagementTable from "@/components/dashboard/OperationComponents/JobManagementTable"
import { getJobOrdersData } from "@/lib/operations/job-orders-data"

export default async function JobManagementPage() {
  const { job_orders } = await getJobOrdersData()

  return (
    <div className="p-6">
      <JobManagementTable initialJobOrders={job_orders} />
    </div>
  )
}
