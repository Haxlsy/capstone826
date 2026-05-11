"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  AlertTriangle,
  Archive,
  UserCheck,
  Wrench,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react"

const JOB_MGMT_PATHS = [
  "/dashboard/job-management",
  "/dashboard/job-order-records",
  "/dashboard/technician-availability",
]

const jobMgmtSubItems = [
  { label: "Job Order",               href: "/dashboard/job-management",          icon: ClipboardList },
  { label: "Job Records",             href: "/dashboard/job-order-records",        icon: Archive },
  { label: "Technician Availability", href: "/dashboard/technician-availability",  icon: UserCheck },
]

const topItems = [
  { label: "Dashboard", href: "/dashboard/operations", icon: LayoutDashboard },
]

const bottomItems = [
  { label: "Concerns",           href: "/dashboard/concerns", icon: AlertTriangle, showBadge: true },
]

export default function OperationsSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const [pendingConcerns, setPendingConcerns] = useState(0)
  const [jobMgmtOpen,     setJobMgmtOpen]     = useState(false)

  const isJobMgmtActive = JOB_MGMT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  useEffect(() => {
    if (isJobMgmtActive) setJobMgmtOpen(true)
  }, [isJobMgmtActive])

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

  function navLinkCls(active: boolean) {
    return `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active
        ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500 pl-2 pr-3"
        : "px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
    }`
  }

  return (
    <aside className="w-60 bg-white border-r border-gray-100 flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white font-bold text-xs tracking-tight">
          826
        </div>
        <span className="font-semibold text-gray-800 text-sm">826 Auto Care</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {/* Top flat items (Dashboard) */}
        {topItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link key={href} href={href} className={navLinkCls(active)}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}

        {/* Job Management collapsible group */}
        <button
          type="button"
          onClick={() => setJobMgmtOpen((o) => !o)}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isJobMgmtActive
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-left">Job Management</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${jobMgmtOpen ? "rotate-180" : ""}`} />
        </button>

        {jobMgmtOpen && (
          <div className="ml-4 pl-3 border-l border-gray-100 space-y-0.5 mt-0.5">
            {jobMgmtSubItems.map(({ label, href, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500 pl-2 pr-3"
                      : "px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </Link>
              )
            })}
          </div>
        )}

        {/* Bottom flat items (Concerns, Service Management) */}
        {bottomItems.map(({ label, href, icon: Icon, showBadge }) => {
          const active     = pathname === href || pathname.startsWith(href + "/")
          const badgeCount = showBadge ? pendingConcerns : 0
          return (
            <Link key={href} href={href} className={navLinkCls(active)}>
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {showBadge && badgeCount > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="py-4 px-3 border-t border-gray-100 space-y-0.5">
        <Link
          href="/dashboard/operations/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/dashboard/operations/settings"
              ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500 pl-2 pr-3"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Log Out
        </button>
      </div>
    </aside>
  )
}
