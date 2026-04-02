"use client";

import { useRouter } from "next/navigation";
import { CONCERNS } from "./technician_component/concernData";
import { ConcernCard } from "./technician_component/ConcernCard";
import { BottomNav } from "./technician_component/BottomNav";

export default function MyConcernsPage() {
  const router = useRouter();

  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">My Concerns</h1>
          <button
            onClick={() => router.push("/technician/concerns/report")}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            + Report
          </button>
        </div>

        {/* Concerns List */}
        <div className="flex flex-col gap-4">
          {CONCERNS.map((concern) => (
            <ConcernCard key={concern.id} concern={concern} />
          ))}
        </div>
      </main>

      <BottomNav active="concerns" />
    </>
  );
}
