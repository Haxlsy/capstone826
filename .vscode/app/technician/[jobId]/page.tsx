import JobDetailPage from "@/components/technician/JobDetailPage";

export default async function JobDetailRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <div className="pb-16">
      <JobDetailPage jobId={jobId} />
    </div>
  );
}
