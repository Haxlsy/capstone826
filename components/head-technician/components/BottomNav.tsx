"use client";

import { useRouter } from "next/navigation";
import { BriefcaseBusiness, TriangleAlert, Settings, LogOut } from "lucide-react";

export type ActiveTab = "jobs" | "concerns" | "settings";

type NavItem = {
  id: ActiveTab | "logout";
  label: string;
  icon: React.ElementType;
  href?: string;
  danger?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: "jobs",     label: "Jobs",     icon: BriefcaseBusiness, href: "/head-technician" },
  { id: "concerns", label: "Concerns", icon: TriangleAlert,     href: "/head-technician/concerns" },
  { id: "settings", label: "Settings", icon: Settings,          href: "/head-technician/settings" },
  { id: "logout",   label: "Log Out",  icon: LogOut,            danger: true },
];

type BottomNavProps = {
  active?: ActiveTab;
};

export function BottomNav({ active = "jobs" }: BottomNavProps) {
  const router = useRouter();

  async function handleLogout() {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    try { localStorage.removeItem("826_user") } catch {}
    router.push("/");
  }

  function handlePress(item: NavItem) {
    if (item.id === "logout") {
      handleLogout();
    } else if (item.href) {
      router.push(item.href);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 pointer-events-none">
      <nav className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/12 border border-gray-200/60 px-3 py-2.5 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;

          if (item.danger) {
            return (
              <button
                key={item.id}
                onClick={() => handlePress(item)}
                className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handlePress(item)}
              className={`relative flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2 : 1.8}
              />
              <span className="text-[10px] font-semibold tracking-wide">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
