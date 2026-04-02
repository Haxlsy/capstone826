"use client";

import { Camera, Check, CircleCheckBig, Flag } from "lucide-react";
import { Job } from "./types";

type QualityCheckReviewProps = {
  job: Job;
};

export function QualityCheckReview({ job }: QualityCheckReviewProps) {
  return (
    <div className="space-y-5">
      {/* Stage Documentation Review */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Stage Documentation Review</h2>
        <div className="space-y-3">
          {job.stages.map((stage, index) => (
            <div key={index} className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </span>
                <span className="font-medium text-sm text-gray-800">
                  {index + 1}. {stage.name}
                </span>
              </div>
              {stage.timestamp && (
                <p className="text-xs text-gray-400 ml-7">{stage.timestamp}</p>
              )}
              <div className="flex gap-2 ml-7">
                <div className="w-12 h-12 bg-gray-100 rounded-lg" />
                <div className="w-12 h-12 bg-gray-100 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Documentation Upload */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-1">Final Documentation Upload</h2>
        <p className="text-xs text-gray-400 mb-3">Upload final inspection photos/videos.</p>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center gap-2 bg-white">
          <Camera size={32} className="text-gray-400" />
          <p className="text-sm text-gray-500">Tap to upload</p>
        </div>
      </div>

      {/* Actions */}
      <button className="w-full bg-green-500 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
        <CircleCheckBig size={18} />
        Approve Job
      </button>
      <button className="w-full border border-red-400 text-red-500 rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2">
        <Flag size={16} />
        Flag for Rework
      </button>
    </div>
  );
}
