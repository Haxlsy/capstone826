import ReportConcernPage from "@/components/technician/ReportConcernPage";

export default async function ReportConcernRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <div className="pb-16">
      <ReportConcernPage jobId={jobId} />
    </div>
  );
}
