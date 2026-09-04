import SalesJobDetail from "@/components/dashboard/SalesDashboard/SalesJobDetail"
import { getJobDetailData } from "@/lib/operations/job-detail-data"

export default async function SalesJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getJobDetailData(id)
  return (
    <div className="p-6">
      <SalesJobDetail job={data.job} />
    </div>
  )
}
