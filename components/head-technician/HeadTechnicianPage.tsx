"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { ACTIVE_JOBS } from "./components/data";
import { HeadTechJobCard } from "./components/HeadTechJobCard";
import { HeadTechFilters } from "./components/HeadTechFilters";
import { BottomNav } from "./components/BottomNav";
import { Status } from "./components/types";

export default function HeadTechnicianPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");

  const filteredJobs = ACTIVE_JOBS.filter((job) => {
    if (statusFilter !== "all" && job.status !== (statusFilter as Status)) return false;
    if (technicianFilter !== "all" && job.technician_name !== technicianFilter) return false;
    return true;
  });

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Active Jobs</h1>
          <button className="relative p-1">
            <Bell size={22} className="text-gray-700" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              2
            </span>
          </button>
        </div>

        {/* Filters */}
        <HeadTechFilters
          statusFilter={statusFilter}
          technicianFilter={technicianFilter}
          onStatusChange={setStatusFilter}
          onTechnicianChange={setTechnicianFilter}
        />

        {/* Job List */}
        <div className="mt-4 flex flex-col gap-4">
          {filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job} />
          ))}
          {filteredJobs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No jobs found.</p>
          )}
        </div>
      </main>

      <BottomNav active="jobs" />
    </>
  );
}
