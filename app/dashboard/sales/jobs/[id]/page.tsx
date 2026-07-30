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
    <div className="h-full overflow-y-auto p-6 flex flex-col">
      <SalesJobDetail job={data.job} />
    </div>
  )
}
