"use client";

import { Paperclip } from "lucide-react";
import {
  HeadTechConcern,
  HEAD_TECH_CONCERN_STATUS_STYLES,
  HEAD_TECH_CONCERN_TYPE_STYLES,
} from "./headTechConcernData";

type HeadTechConcernCardProps = {
  concern: HeadTechConcern;
};

export function HeadTechConcernCard({ concern }: HeadTechConcernCardProps) {
  const typeStyle =
    HEAD_TECH_CONCERN_TYPE_STYLES[concern.concern_type] ?? "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
      {/* Top row: job ID + status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-600">{concern.job_id}</span>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${HEAD_TECH_CONCERN_STATUS_STYLES[concern.status]}`}
        >
          {concern.status}
        </span>
      </div>

      {/* Technician name */}
      <p className="text-sm font-medium text-gray-800">{concern.technician_name}</p>

      {/* Concern type pill */}
      <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${typeStyle}`}>
        {concern.concern_type}
      </span>

      {/* Description */}
      <p className="text-sm text-gray-600 leading-snug">{concern.description}</p>

      {/* Footer: attachments + timestamp */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-gray-400">
          <Paperclip size={13} />
          <span className="text-xs">{concern.attachments}</span>
        </div>
        <span className="text-xs text-gray-400">{concern.timestamp}</span>
      </div>
    </div>
  );
}
