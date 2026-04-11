"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  MessageCircle,
  Users,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { label: "Inquiry Management", href: "/dashboard/sales", icon: MessageCircle },
  { label: "Customer Records", href: "/dashboard/sales/customer-records", icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    try { localStorage.removeItem("826_user") } catch {}
    router.push("/")
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
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = pathname === href
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
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="py-4 px-3 border-t border-gray-100 space-y-0.5">
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/dashboard/settings"
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
