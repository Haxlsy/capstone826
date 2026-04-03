"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { type Job } from "./technician_component/types";
import { JobCardView } from "./technician_component/JobCardView";
import { JobFilters } from "./technician_component/JobFilters";
import { BottomNav } from "./technician_component/BottomNav";
import { Status } from "./technician_component/types";

export default function Technician() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/technician/jobs");
        const json = await res.json();
        if (res.ok) setJobs(json.jobs ?? []);
      } catch {
        // leave empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== (statusFilter as Status)) return false;
    return true;
  });

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">My Jobs</h1>
          <button className="relative p-1">
            <Bell size={22} className="text-gray-700" />
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              1
            </span>
          </button>
        </div>

        {/* Filters */}
        <JobFilters
          dateFilter={dateFilter}
          statusFilter={statusFilter}
          onDateChange={setDateFilter}
          onStatusChange={setStatusFilter}
        />

        {/* Job List */}
        <div className="mt-4 flex flex-col gap-4">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">Loading jobs...</p>
          )}
          {!loading && filteredJobs.map((job) => (
            <JobCardView
              key={job.raw_id ?? job.job_id}
              job={job}
              onClick={() => router.push(`/technician/${job.raw_id ?? job.job_id}`)}
            />
          ))}
          {!loading && filteredJobs.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No jobs found.</p>
          )}
        </div>
      </main>

      <BottomNav active="jobs" />
    </>
  );
}
