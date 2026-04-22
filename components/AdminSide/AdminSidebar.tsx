"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import {
  LayoutDashboard,
  Users,
  Bot,
  Settings,
  LogOut,
} from "lucide-react"

const navItems = [
  { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { label: "Account Management", href: "/dashboard/admin/accounts", icon: Users },
  { label: "AI Chatbot", href: "/dashboard/admin/chatbot", icon: Bot },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {}
    try { localStorage.removeItem("826_user") } catch {}
    router.push("/")
  }

  function navClass(active: boolean) {
    const base = `flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-2" : ""}`
    if (active) return `${base} ${collapsed ? "px-2" : "border-l-[3px] pl-2 pr-3"} bg-(--color-primary) text-white border-(--color-info)`
    return `${base} px-3 text-(--color-white)/70 hover:bg-(--color-base-medium) hover:text-white`
  }

  return (
    <aside className={`${collapsed ? "w-16" : "w-60"} flex flex-col shrink-0 h-full transition-all duration-200 overflow-hidden border-r border-(--color-border) bg-(--color-base-dark)`}>
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
        {navItems.map(({ label, href, icon: Icon }) => {
          const isExact    = pathname === href
          const isSubRoute = pathname.startsWith(href + "/") && href !== "/dashboard/admin"
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined} className={navClass(isExact || isSubRoute)}>
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="py-4 px-2 border-t border-(--color-border) space-y-0.5">
        <Link
          href="/dashboard/admin/settings"
          title={collapsed ? "Settings" : undefined}
          className={navClass(pathname === "/dashboard/admin/settings")}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
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
