"use client";

import { Status } from "./types";
import { TECHNICIANS } from "./data";

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "Quality Check",
  "Completed",
  "Delayed",
  "Cancelled",
  "Released",
];

type HeadTechFiltersProps = {
  statusFilter: string;
  technicianFilter: string;
  onStatusChange: (value: string) => void;
  onTechnicianChange: (value: string) => void;
};

export function HeadTechFilters({
  statusFilter,
  technicianFilter,
  onStatusChange,
  onTechnicianChange,
}: HeadTechFiltersProps) {
  return (
    <div className="flex gap-2 mt-3">
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">Status: All</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <select
        value={technicianFilter}
        onChange={(e) => onTechnicianChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">Technician: All</option>
        {TECHNICIANS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}
