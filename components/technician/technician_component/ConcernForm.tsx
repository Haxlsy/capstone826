"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { Job } from "./types";
import { JOBS } from "./data";

const CONCERN_TYPES = [
  "Material Issue",
  "Equipment Problem",
  "Rework Needed",
  "Safety Issue",
  "Customer Request",
  "Other",
];

type ConcernFormProps = {
  job?: Job;
};

export function ConcernForm({ job }: ConcernFormProps) {
  const [selectedJobId, setSelectedJobId] = useState(
    job ? job.job_id : JOBS[0].job_id
  );
  const [concernType, setConcernType] = useState(CONCERN_TYPES[0]);
  const [description, setDescription] = useState("");

  const selectedJob = job ?? JOBS.find((j) => j.job_id === selectedJobId);

  return (
    <div className="space-y-5">
      {/* Job Reference */}
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Job Reference</label>
        {job ? (
          // Pre-filled read-only when coming from a job detail
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800">
            {job.job_id} — {job.service}
          </div>
        ) : (
          // Selectable when coming from My Concerns
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {JOBS.map((j) => (
              <option key={j.job_id} value={j.job_id}>
                {j.job_id} — {j.service}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Concern Type */}
      <div>
        <label className="text-sm font-medium text-gray-800 mb-2 block">
          Concern Type
        </label>
        <div className="relative">
          <select
            value={concernType}
            onChange={(e) => setConcernType(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 pr-10"
          >
            {CONCERN_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
            ▾
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-sm font-medium text-gray-800 mb-2 block">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the concern in detail..."
          rows={5}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>

      {/* Photo Attachment */}
      <div>
        <label className="text-sm font-medium text-gray-800 mb-2 block">
          Photo Attachment{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
          <Camera size={28} className="text-gray-400" />
          <p className="text-sm text-gray-400">Attach Photo (optional)</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">JPG, JPEG, PNG (max 5MB)</p>
      </div>

      {/* Submit */}
      <button className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-semibold">
        Submit Concern
      </button>
    </div>
  );
}
