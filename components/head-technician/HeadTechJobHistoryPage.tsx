"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";
import { BottomNav } from "./components/BottomNav";

const STATUS_BADGE: Record<string, string> = {
  Pending:       "bg-yellow-100 text-yellow-700",
  Ongoing:       "bg-blue-100 text-blue-600",
  "For Rework":  "bg-orange-100 text-orange-600",
  "For Release": "bg-green-100 text-green-600",
  Released:      "bg-teal-100 text-teal-600",
  Delayed:       "bg-red-100 text-red-600",
  Cancelled:     "bg-gray-200 text-gray-600",
};

interface TimelineEntry {
  status: string;
  changed_at: string;
  changed_by: string | null;
}

interface StageMedia {
  url: string;
  type: string;
}

interface StageDoc {
  stage_template_id: number;
  name: string;
  order: number;
  done: boolean;
  submitted_at: string | null;
  media: StageMedia[];
}

interface JobDetail {
  job_id: string;
  raw_id: number;
  customer_name: string;
  plate_number: string;
  car_make: string;
  car_color: string;
  service: string;
  technician_name: string;
  scheduled_start: string;
  status: string;
  timeline: TimelineEntry[];
  stages: StageDoc[];
}

type Props = {
  jobId: string;
};

export default function HeadTechJobHistoryPage({ jobId }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStages, setOpenStages] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/head-technician/jobs/${jobId}`);
        const json = await res.json();
        if (res.ok && json.job) setJob(json.job);
      } catch {
        // leave null
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  function toggleStage(id: number) {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <main className="px-4 py-4 max-w-md mx-auto">
        <p className="text-sm text-gray-400 text-center py-12">Loading...</p>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="px-4 py-4 max-w-md mx-auto">
        <p className="text-sm text-gray-500 text-center py-12">Job not found.</p>
      </main>
    );
  }

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-gray-700 font-medium"
          >
            <ChevronLeft size={20} />
            Job History
          </button>
          <span className="text-sm font-medium text-gray-500">{job.job_id}</span>
        </div>

        {/* Info Card */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Customer</span>
            <span className="text-gray-900 font-medium">{job.customer_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Vehicle</span>
            <span className="text-gray-900 font-medium text-right">
              {job.plate_number} — {job.car_make} ({job.car_color})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Service</span>
            <span className="text-orange-500 font-medium">{job.service}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Technician</span>
            <span className="text-blue-600 font-medium">{job.technician_name}</span>
          </div>
        </div>

        {/* Status Timeline */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Status Timeline</h2>
          {job.timeline.length === 0 && (
            <p className="text-sm text-gray-400">No status history recorded.</p>
          )}
          <div className="relative pl-6">
            {/* Vertical line */}
            {job.timeline.length > 1 && (
              <span className="absolute left-[9px] top-3 bottom-3 w-px bg-gray-200" />
            )}

            <div className="space-y-5">
              {job.timeline.map((entry, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  {/* Circle */}
                  <span className="absolute -left-6 mt-0.5 w-4 h-4 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  </span>

                  <div className="space-y-0.5">
                    <span
                      className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[entry.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {entry.status}
                    </span>
                    <p className="text-xs text-gray-400">{entry.changed_at}</p>
                    <p className="text-xs text-gray-500">
                      {entry.changed_by ? `Technician: ${entry.changed_by}` : "System"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stage Documentation */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Stage Documentation</h2>
          {job.stages.length === 0 && (
            <p className="text-sm text-gray-400">No stages defined for this service.</p>
          )}
          <div className="space-y-2">
            {job.stages.map((stage) => {
              const isOpen = openStages.has(stage.stage_template_id);
              return (
                <div
                  key={stage.stage_template_id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  {/* Accordion header */}
                  <button
                    onClick={() => toggleStage(stage.stage_template_id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-gray-800"
                  >
                    <span>
                      {stage.order}. {stage.name}
                    </span>
                    {isOpen ? (
                      <ChevronDown size={16} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-400" />
                    )}
                  </button>

                  {/* Accordion body */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                      {stage.submitted_at ? (
                        <>
                          <p className="text-xs text-gray-400">{stage.submitted_at}</p>
                          {/* Media thumbnails */}
                          <div className="flex flex-wrap gap-2">
                            {stage.media.length > 0
                              ? stage.media.map((m, mi) =>
                                  m.type === "video" ? (
                                    <video
                                      key={mi}
                                      src={m.url}
                                      className="w-16 h-16 rounded-xl object-cover bg-gray-100"
                                    />
                                  ) : (
                                    <img
                                      key={mi}
                                      src={m.url}
                                      alt={`Stage ${stage.order} media ${mi + 1}`}
                                      className="w-16 h-16 rounded-xl object-cover bg-gray-100"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = "none";
                                      }}
                                    />
                                  )
                                )
                              : // Placeholder boxes when docs exist but no media url
                                Array.from({ length: 2 }).map((_, pi) => (
                                  <div key={pi} className="w-16 h-16 rounded-xl bg-gray-100" />
                                ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No documentation submitted.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <BottomNav active="jobs" />
    </>
  );
}
