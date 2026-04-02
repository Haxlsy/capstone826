"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { type Job } from "./technician_component/types";
import { JobInfoCard } from "./technician_component/JobInfoCard";
import { ServiceStagesList } from "./technician_component/ServiceStagesList";
import { QualityCheckReview } from "./technician_component/QualityCheckReview";
import { BottomNav } from "./technician_component/BottomNav";

type JobDetailPageProps = {
  jobId: string;
};

export default function JobDetailPage({ jobId }: JobDetailPageProps) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const numericId = parseInt(jobId, 10);
        if (!isNaN(numericId)) {
          const res = await fetch(`/api/technician/jobs/${numericId}`);
          const json = await res.json();
          if (res.ok && json.job) {
            setJob(json.job);
            return;
          }
        }
      } catch {
        // fall through to not-found
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  if (loading) {
    return (
      <main className="px-4 py-4 max-w-md mx-auto">
        <p className="text-sm text-gray-400">Loading...</p>
      </main>
    );
  }

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
