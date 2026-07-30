import SalesJobList from "@/components/dashboard/SalesDashboard/SalesJobList"
import { getJobOrdersData } from "@/lib/operations/job-orders-data"

export default async function SalesJobOrdersPage() {
  const data = await getJobOrdersData()
  return (
    <div className="p-6 flex flex-col">
      <SalesJobList jobOrders={data.job_orders} />
    </div>
  )
}
