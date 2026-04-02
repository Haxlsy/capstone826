"use client";

import { HeadTechJob, STATUS_STYLES } from "./types";

type HeadTechJobCardProps = {
  job: HeadTechJob;
};

export function HeadTechJobCard({ job }: HeadTechJobCardProps) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      {/* Top Row */}
      <div className="flex items-center justify-between">
        <p className="font-medium text-sm text-gray-800">{job.job_id}</p>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_STYLES[job.status]}`}
        >
          {job.status}
        </span>
      </div>

      {/* Customer name */}
      <p className="font-semibold text-gray-900">{job.customer_name}</p>

      {/* Vehicle */}
      <p className="text-sm text-gray-500">
        {job.plate_number} — {job.car_make} ({job.car_color})
      </p>

      {/* Service */}
      <p className="text-sm text-gray-700">{job.service}</p>

      {/* Technician + Schedule */}
      <p className="text-xs text-gray-400">
        Tech: {job.technician_name} | {job.scheduled_start}
      </p>

      {/* Progress Bar */}
      <div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{job.progress}% complete</p>
      </div>
    </div>
  );
}
