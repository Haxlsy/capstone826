import JobOrderDetail from "@/components/dashboard/OperationComponents/JobOrderDetail"

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="p-6">
      <JobOrderDetail jobId={id} />
    </div>
  )
}
