"use client";

import { useRouter } from "next/navigation";
import { Briefcase, TriangleAlert, UserRound, LogOut } from "lucide-react";

export type ActiveTab = "jobs" | "concerns" | "profile";

type BottomNavProps = {
  active?: ActiveTab;
};

export function BottomNav({ active = "jobs" }: BottomNavProps) {
  const router = useRouter();
  const base = "flex flex-col items-center gap-1 text-xs";
  const activeClass = "text-blue-600";
  const inactiveClass = "text-gray-400";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    try { localStorage.removeItem("826_user") } catch {}
    router.push("/")
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-3 z-10">
      <button
        onClick={() => router.push("/head-technician")}
        className={`${base} ${active === "jobs" ? activeClass : inactiveClass}`}
      >
        <Briefcase size={20} />
        Jobs
      </button>
      <button
        onClick={() => router.push("/head-technician/concerns")}
        className={`${base} ${active === "concerns" ? activeClass : inactiveClass}`}
      >
        <TriangleAlert size={20} />
        Concerns
      </button>
      <button className={`${base} ${active === "profile" ? activeClass : inactiveClass}`}>
        <UserRound size={20} />
        Profile
      </button>
      <button
        onClick={handleLogout}
        className={`${base} text-red-400 hover:text-red-600`}
      >
        <LogOut size={20} />
        Log Out
      </button>
    </nav>
  );
}
