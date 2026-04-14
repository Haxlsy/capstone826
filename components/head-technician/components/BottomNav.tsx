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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.08)]">
      <nav className="flex items-center justify-around px-2 py-1 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          const Icon = item.icon;

          if (item.danger) {
            return (
              <button
                key={item.id}
                onClick={() => handlePress(item)}
                className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
              >
                <Icon size={20} strokeWidth={1.8} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handlePress(item)}
              className={`relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all duration-150 ${
                isActive
                  ? "text-gray-900"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className={`text-[10px] font-semibold ${isActive ? "text-gray-900" : "text-gray-400"}`}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-gray-900" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
