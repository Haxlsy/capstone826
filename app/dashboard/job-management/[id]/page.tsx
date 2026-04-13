import JobOrderDetail from "@/components/dashboard/OperationComponents/JobOrderDetail"

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <JobOrderDetail jobId={id} />
    </div>
  )
}
