"use client";

import { HEAD_TECH_CONCERNS } from "./components/headTechConcernData";
import { HeadTechConcernCard } from "./components/HeadTechConcernCard";
import { HeadTechConcernBanner } from "./components/HeadTechConcernBanner";
import { BottomNav } from "./components/BottomNav";

export default function HeadTechConcernsPage() {
  return (
    <>
      <main className="px-4 py-4 max-w-md mx-auto pb-24">
        {/* Header */}
        <h1 className="text-lg font-semibold text-gray-900 mb-4">Concerns</h1>

        {/* View-only banner */}
        <HeadTechConcernBanner />

        {/* Concerns list */}
        <div className="mt-4 flex flex-col gap-4">
          {HEAD_TECH_CONCERNS.map((concern) => (
            <HeadTechConcernCard key={concern.id} concern={concern} />
          ))}
          {HEAD_TECH_CONCERNS.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No concerns found.</p>
          )}
        </div>
      </main>

      <BottomNav active="concerns" />
    </>
  );
}
