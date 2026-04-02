"use client";

import { Info } from "lucide-react";

export function HeadTechConcernBanner() {
  return (
    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
      <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
      <p className="text-sm text-blue-600">
        View only. Concern resolution is handled by Operations.
      </p>
    </div>
  );
}
