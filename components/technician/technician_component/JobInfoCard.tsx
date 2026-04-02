"use client";

import { Job, STATUS_STYLES } from "./types";

type JobInfoCardProps = {
  job: Job;
};

export function JobInfoCard({ job }: JobInfoCardProps) {
  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Customer</span>
        <span className="text-gray-900 font-medium">{job.name}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Vehicle</span>
        <span className="text-gray-900 font-medium text-right">
          {job.plate_number} — {job.car_make} ({job.car_color})
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Service</span>
        <span className="text-gray-900 font-medium">{job.service}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-500">Scheduled</span>
        <span className="text-gray-900 font-medium">{job.scheduled_start}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-500">Status</span>
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_STYLES[job.status]}`}>
          {job.status}
        </span>
      </div>
    </div>
  );
}
