import HeadTechJobHistoryPage from "@/components/head-technician/HeadTechJobHistoryPage";

export default async function HeadTechJobDetailRoute({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <div className="pb-16">
      <HeadTechJobHistoryPage jobId={jobId} />
    </div>
  );
}
