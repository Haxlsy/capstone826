"use client";

import {
  Concern,
  CONCERN_STATUS_STYLES,
  CONCERN_TYPE_STYLES,
} from "./concernData";

type ConcernCardProps = {
  concern: Concern;
};

export function ConcernCard({ concern }: ConcernCardProps) {
  const typeStyle =
    CONCERN_TYPE_STYLES[concern.concern_type] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
      {/* Top row: job ID + status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-600">
          {concern.job_id}
        </span>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${CONCERN_STATUS_STYLES[concern.status]}`}
        >
          {concern.status}
        </span>
      </div>

      {/* Concern type pill */}
      <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${typeStyle}`}>
        {concern.concern_type}
      </span>

      {/* Description */}
      <p className="text-sm text-gray-700">{concern.description}</p>

      {/* Response box */}
      {concern.response && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
          <p className="text-sm text-green-700">
            <span className="font-medium">Response: </span>
            {concern.response}
          </p>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-gray-400">{concern.timestamp}</p>
    </div>
  );
}
