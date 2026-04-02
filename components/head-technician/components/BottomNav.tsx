"use client";

import { Briefcase, TriangleAlert, UserRound } from "lucide-react";

export type ActiveTab = "jobs" | "concerns" | "profile";

type BottomNavProps = {
  active?: ActiveTab;
};

export function BottomNav({ active = "jobs" }: BottomNavProps) {
  const base = "flex flex-col items-center gap-1 text-xs";
  const activeClass = "text-blue-600";
  const inactiveClass = "text-gray-400";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 z-10">
      <button className={`${base} ${active === "jobs" ? activeClass : inactiveClass}`}>
        <Briefcase size={20} />
        Jobs
      </button>
      <button className={`${base} ${active === "concerns" ? activeClass : inactiveClass}`}>
        <TriangleAlert size={20} />
        Concerns
      </button>
      <button className={`${base} ${active === "profile" ? activeClass : inactiveClass}`}>
        <UserRound size={20} />
        Profile
      </button>
    </nav>
  );
}
