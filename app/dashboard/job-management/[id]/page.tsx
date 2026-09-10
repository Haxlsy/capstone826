import JobOrderDetail from "@/components/dashboard/OperationComponents/JobOrderDetail"
import { getJobDetailData } from "@/lib/operations/job-detail-data"

export default async function JobOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Best-effort — a bad/stale id falls through to the client's own
  // fetch+error handling (unchanged), same as before this initialJob prop
  // existed at all.
  let initialJob = null
  try {
    initialJob = (await getJobDetailData(id)).job
  } catch {
    // handled client-side
  }

  return (
    <div className="p-6">
      <JobOrderDetail jobId={id} initialJob={initialJob} />
    </div>
  )
}
