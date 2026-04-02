"use client";

import { useRouter } from "next/navigation";
import { Camera, Check, Lock } from "lucide-react";
import { Job } from "./types";

type ServiceStagesListProps = {
  job: Job;
};

export function ServiceStagesList({ job }: ServiceStagesListProps) {
  const router = useRouter();
  return (
    <div className="space-y-5">
      {/* Job Status */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-2">Job Status</h2>
        <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 mb-3">
          Currently: {job.status}
        </div>
        {job.status === "Ongoing" && (
          <button className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold">
            Submit for Quality Check
          </button>
        )}
      </div>

      {/* Service Stages */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Service Stages</h2>
        <div className="space-y-3">
          {job.stages.map((stage, index) => {
            if (stage.status === "completed") {
              return (
                <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                      <Check size={12} strokeWidth={3} className="text-white" />
                    </span>
                    <span className="font-medium text-sm text-gray-800">
                      {index + 1}. {stage.name}
                    </span>
                  </div>
                  {stage.timestamp && (
                    <p className="text-xs text-gray-400 ml-7">{stage.timestamp}</p>
                  )}
                  <div className="flex gap-2 ml-7">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg" />
                    <div className="w-12 h-12 bg-gray-100 rounded-lg" />
                  </div>
                </div>
              );
            }

            if (stage.status === "active") {
              return (
                <div key={index} className="bg-blue-50 rounded-2xl p-4 border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-500 shrink-0" />
                    <span className="font-medium text-sm text-gray-800">
                      {index + 1}. {stage.name}
                    </span>
                  </div>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-2 bg-white">
                    <Camera size={32} className="text-gray-400" />
                    <p className="text-sm text-gray-500">Upload Photos/Videos</p>
                    <p className="text-xs text-gray-400 text-center">
                      JPG, JPEG, PNG (max 5MB) | MP4, MOV (max 50MB)
                    </p>
                  </div>
                  <button className="w-full bg-blue-500 text-white rounded-xl py-3 text-sm font-semibold">
                    Mark Stage as Done
                  </button>
                  <p className="text-xs text-gray-400 text-center">
                    Upload at least one file to continue
                  </p>
                </div>
              );
            }

            // pending
            return (
              <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Lock size={10} className="text-gray-400" />
                  </span>
                  <span className="text-sm text-gray-400">
                    {index + 1}. {stage.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Report a Concern */}
      <button
        onClick={() => router.push(`/technician/${job.job_id}/concern`)}
        className="w-full border border-red-400 text-red-500 rounded-xl py-3 text-sm font-medium"
      >
        Report a Concern
      </button>
    </div>
  );
}
