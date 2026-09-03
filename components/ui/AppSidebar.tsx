"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLogout } from "@/hooks/useLogout"

export interface NavChild {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
}

export interface NavItem {
  label: string
  href?: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
  children?: NavChild[]
}

const STORAGE_KEY = "826_sidebar_collapsed"

function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = React.useState(false)
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1")
    } catch {
      /* ignore */
    }
  }, [])
  const toggle = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  return [collapsed, toggle]
}

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppSidebar({
  nav,
  settingsHref,
  brand = "826 Auto Care",
}: {
  nav: NavItem[]
  settingsHref: string
  brand?: string
}) {
  const pathname = usePathname()
  const [collapsed, toggle] = useCollapsed()
  const logout = useLogout()

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-full shrink-0 flex-col bg-shell text-white transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-shell-border px-4 py-4",
          collapsed ? "flex-col gap-2" : "gap-2.5",
        )}
      >
        <Image
          src="/assets/826-logo.png"
          alt="826"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
        />
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold text-display">{brand}</span>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-sm text-white/60 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scroll-track">
        {nav.map((item) => (
          <NavNode key={item.label} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-1 border-t border-shell-border px-3 py-4">
        <SidebarLink
          href={settingsHref}
          icon={Settings}
          label="Settings"
          active={isActive(pathname, settingsHref)}
          collapsed={collapsed}
        />
        <button
          type="button"
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-status-delayed/20 hover:text-white",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Log Out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Log Out"}
        </button>
      </div>
    </aside>
  )
}

function NavNode({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const childActive = item.children?.some((c) => isActive(pathname, c.href, c.exact)) ?? false
  const [open, setOpen] = React.useState(childActive)
  React.useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  if (!item.children) {
    return (
      <SidebarLink
        href={item.href!}
        icon={item.icon}
        label={item.label}
        badge={item.badge}
        active={isActive(pathname, item.href!, item.exact)}
        collapsed={collapsed}
      />
    )
  }

  // Collapsed: render the group as a flat icon that links to the first child.
  if (collapsed) {
    return (
      <SidebarLink
        href={item.children[0].href}
        icon={item.icon}
        label={item.label}
        active={childActive}
        collapsed
      />
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors",
          childActive ? "text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-shell-border pl-3">
          {item.children.map((c) => (
            <SidebarLink
              key={c.href}
              href={c.href}
              icon={c.icon}
              label={c.label}
              active={isActive(pathname, c.href, c.exact)}
              collapsed={false}
              nested
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  badge,
  active,
  collapsed,
  nested,
}: {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
  active: boolean
  collapsed: boolean
  nested?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-sm px-3 text-sm font-medium transition-colors",
        nested ? "py-2" : "py-2.5",
        collapsed && "justify-center px-0",
        active
          ? "bg-white text-primary shadow-card"
          : "text-white/60 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && typeof badge === "number" && badge > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-status-delayed px-1 text-[10px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {collapsed && typeof badge === "number" && badge > 0 && (
        <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-status-delayed" />
      )}
    </Link>
  )
}
