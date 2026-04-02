"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { JOBS } from "./technician_component/data";
import { ConcernForm } from "./technician_component/ConcernForm";
import { BottomNav } from "./technician_component/BottomNav";

type ReportConcernPageProps = {
  jobId?: string;
};

export default function ReportConcernPage({ jobId }: ReportConcernPageProps) {
  const router = useRouter();
  const job = jobId ? JOBS.find((j) => j.job_id === jobId) : undefined;

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="text-gray-700">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-base font-semibold text-gray-900">
            Report a Concern
          </h1>
        </div>

        {/* Form — job pre-filled if coming from job detail, selectable otherwise */}
        <ConcernForm job={job} />
      </main>

      <BottomNav active="concerns" />
    </>
  );
}
