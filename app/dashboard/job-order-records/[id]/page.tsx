import JobOrderDetail from "@/components/dashboard/OperationComponents/JobOrderDetail"
import { getJobDetailData } from "@/lib/operations/job-detail-data"
import { resolveDetailBack } from "@/lib/operations/detail-back"

// Job Records' own detail route, pointing at the exact same page as
// /dashboard/job-management/[id] — so the URL itself (not a ?from= query
// param) carries "which section you're in," and the sidebar's plain
// pathname-prefix match highlights "Job Records" instead of "Job Order".
export default async function JobOrderRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const back = resolveDetailBack("records")

  // Best-effort — a bad/stale id falls through to the client's own
  // fetch+error handling (unchanged), same as the job-management route.
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
