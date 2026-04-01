"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  AlertTriangle,
  Archive,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/dashboard/operations", icon: LayoutDashboard },
  { label: "Job Management", href: "/dashboard/job-management", icon: ClipboardList },
  { label: "Customer Intake Records", href: "/dashboard/customer-intake-records", icon: FileText },
  { label: "Concerns", href: "/dashboard/concerns", icon: AlertTriangle, badge: 3 },
  { label: "Job Order Records", href: "/dashboard/job-order-records", icon: Archive },
]

export default function OperationsSidebar() {
  const pathname = usePathname()

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
        {navItems.map(({ label, href, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-600 border-l-4 border-blue-500 pl-2 pr-3"
                  : "px-3 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {badge !== undefined && (
                <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
