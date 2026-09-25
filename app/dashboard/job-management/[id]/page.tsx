import JobOrderDetail from "@/components/dashboard/OperationComponents/JobOrderDetail"
import { getJobDetailData } from "@/lib/operations/job-detail-data"
import { resolveDetailBack } from "@/lib/operations/detail-back"

export default async function JobOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { id } = await params
  const back = resolveDetailBack((await searchParams).from)

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
      <JobOrderDetail jobId={id} initialJob={initialJob} backHref={back.href} backLabel={back.label} />
    </div>
  )
}
