"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { HeadTechJob, Status } from "./components/types";
import { HeadTechJobCard } from "./components/HeadTechJobCard";
import { HeadTechFilters } from "./components/HeadTechFilters";
import { BottomNav } from "./components/BottomNav";

export default function HeadTechnicianPage() {
  const [jobs, setJobs] = useState<HeadTechJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [technicianFilter, setTechnicianFilter] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/head-technician/jobs");
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

  // Derive unique technician names from live data
  const technicians = Array.from(
    new Set(jobs.map((j) => j.technician_name).filter(Boolean))
  );

  const filteredJobs = jobs.filter((job) => {
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
          technicians={technicians}
          onStatusChange={setStatusFilter}
          onTechnicianChange={setTechnicianFilter}
        />

        {/* Job List */}
        <div className="mt-4 flex flex-col gap-4">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">Loading jobs...</p>
          )}
          {!loading && filteredJobs.map((job) => (
            <HeadTechJobCard key={job.job_id} job={job} />
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
