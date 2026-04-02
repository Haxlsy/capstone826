"use client";

import { Status } from "./types";

type JobFiltersProps = {
  dateFilter: string;
  statusFilter: string;
  onDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
};

const STATUS_OPTIONS: Status[] = [
  "Pending",
  "Ongoing",
  "Quality Check",
  "Completed",
  "Delayed",
  "Cancelled",
  "Released",
];

export function JobFilters({
  dateFilter,
  statusFilter,
  onDateChange,
  onStatusChange,
}: JobFiltersProps) {
  return (
    <div className="flex gap-2 mt-3">
      <select
        value={dateFilter}
        onChange={(e) => onDateChange(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100"
      >
        <option value="all">Date: All</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
      </select>

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
    </div>
  );
}
