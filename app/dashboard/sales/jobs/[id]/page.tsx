import SalesJobDetail from "@/components/dashboard/SalesDashboard/SalesJobDetail"

export default async function SalesJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col">
      <SalesJobDetail jobId={id} />
    </div>
  )
}
