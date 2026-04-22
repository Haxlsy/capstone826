"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Archive,
  UserCheck,
  Wrench,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { label: "Dashboard",               href: "/dashboard/operations",               icon: LayoutDashboard },
  { label: "Job Management",          href: "/dashboard/job-management",           icon: ClipboardList },
  { label: "Concerns",                href: "/dashboard/concerns",                 icon: AlertTriangle, showBadge: true },
  { label: "Job Order Records",       href: "/dashboard/job-order-records",        icon: Archive },
  { label: "Technician Availability", href: "/dashboard/technician-availability",  icon: UserCheck },
  { label: "Service Management",      href: "/dashboard/services",                 icon: Wrench },
]

export default function OperationsSidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [pendingConcerns, setPendingConcerns] = useState(0)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    async function fetchPendingCount() {
      try {
        const res  = await fetch("/api/operations/job-concerns")
        const json = await res.json()
        if (res.ok) {
          const count = (json.concerns ?? []).filter((c: { status: string }) => c.status === "Pending").length
          setPendingConcerns(count)
        }
      } catch {}
    }
    fetchPendingCount()
  }, [pathname])

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    try { localStorage.removeItem("826_user") } catch {}
    router.push("/")
  }

  function navClass(active: boolean) {
    const base = `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-2" : ""}`
    if (active) return `${base} ${collapsed ? "px-2" : "border-l-[3px] pl-2 pr-3"} bg-(--color-base-medium) text-white border-(--color-accent)`
    return `${base} px-3 text-white/60 hover:bg-(--color-base-medium) hover:text-white`
  }

  return (
    <aside className={`${collapsed ? "w-16" : "w-60"} flex flex-col shrink-0 h-full transition-all duration-200 overflow-hidden border-r border-(--color-border) bg-(--color-primary)`}>
      {/* Logo */}
      <div className="flex items-center px-3 py-4 border-b border-(--color-border)">
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="cursor-pointer shrink-0"
        >
          <img src="/assets/826-logo.svg" alt="826 Auto Care" width={48} height={48} className="rounded-lg" />
        </button>
        {!collapsed && (
          <span className="font-semibold text-white text-sm truncate ml-3">826 Auto Care</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {navItems.map(({ label, href, icon: Icon, showBadge }) => {
          const active     = pathname === href || pathname.startsWith(href + "/")
          const badgeCount = showBadge ? pendingConcerns : 0
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined} className={navClass(active)}>
              <div className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {showBadge && badgeCount > 0 && collapsed && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && showBadge && badgeCount > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="py-4 px-2 border-t border-(--color-border) space-y-0.5">
        <Link
          href="/dashboard/operations/settings"
          title={collapsed ? "Settings" : undefined}
          className={navClass(pathname === "/dashboard/operations/settings")}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && "Settings"}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? "Log Out" : undefined}
          className={`flex items-center gap-3 w-full py-2.5 rounded-lg text-sm font-medium transition-colors text-white/60 hover:bg-(--color-error)/20 hover:text-(--color-error) ${collapsed ? "justify-center px-2" : "px-3"}`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "Log Out"}
        </button>
      </div>
    </aside>
  )
}
