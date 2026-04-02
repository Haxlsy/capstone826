"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { JOBS } from "./technician_component/data";
import { JobInfoCard } from "./technician_component/JobInfoCard";
import { ServiceStagesList } from "./technician_component/ServiceStagesList";
import { QualityCheckReview } from "./technician_component/QualityCheckReview";
import { BottomNav } from "./technician_component/BottomNav";

type JobDetailPageProps = {
  jobId: string;
};

export default function JobDetailPage({ jobId }: JobDetailPageProps) {
  const router = useRouter();
  const job = JOBS.find((j) => j.job_id === jobId);

  if (!job) {
    return (
      <main className="px-4 py-4 max-w-md mx-auto">
        <p className="text-gray-500 text-sm">Job not found.</p>
      </main>
    );
  }

  const isQualityCheck = job.status === "Quality Check";
  const headerTitle = isQualityCheck ? "Quality Check" : "Job Detail";

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-700 font-medium"
          >
            <ChevronLeft size={20} />
            {headerTitle}
          </button>
          <span className="text-sm font-medium text-gray-500">{job.job_id}</span>
        </div>

        {/* Job Info Card */}
        <JobInfoCard job={job} />

        {/* Body — switches based on status */}
        {isQualityCheck ? (
          <QualityCheckReview job={job} />
        ) : (
          <ServiceStagesList job={job} />
        )}
      </main>

      <BottomNav active="jobs" />
    </>
  );
}
