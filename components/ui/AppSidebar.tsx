"use client"

import * as React from "react"
import Link, { useLinkStatus } from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Settings,
  WifiOff,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLogoutConfirm } from "@/hooks/useLogout"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { ConfirmModal } from "@/components/ui/Modal"

export interface NavChild {
  label: string
  href: string
  icon: LucideIcon
  exact?: boolean
  /** Not navigable while offline (data-only page that would show stale info). */
  disabledOffline?: boolean
}

export interface NavItem {
  label: string
  href?: string
  icon: LucideIcon
  exact?: boolean
  badge?: number
  children?: NavChild[]
  /** Not navigable while offline (data-only page that would show stale info). */
  disabledOffline?: boolean
}

/** Whether the sidebar's links can navigate — false while offline. */
const SidebarOnlineContext = React.createContext(true)

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
  lockSettingsOffline = false,
}: {
  nav: NavItem[]
  settingsHref: string
  brand?: string
  /** Grey out the Settings link while offline (Operations only). */
  lockSettingsOffline?: boolean
}) {
  const pathname = usePathname()
  const [collapsed, toggle] = useCollapsed()
  const isOnline = useOnlineStatus()
  const { confirming, loading, requestLogout, cancel, confirm } = useLogoutConfirm()

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-full shrink-0 flex-col bg-shell text-white transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-shell-border py-4",
          collapsed ? "flex-col gap-2 px-2" : "gap-2.5 px-4",
        )}
      >
        <Image
          src="/assets/main-logo.png"
          alt="826"
          width={342}
          height={100}
          className="h-4 w-auto shrink-0 object-contain object-left"
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

      <SidebarOnlineContext.Provider value={isOnline}>
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
            disabledOffline={lockSettingsOffline}
          />
          <button
            type="button"
            onClick={requestLogout}
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
      </SidebarOnlineContext.Provider>

      <ConfirmModal
        open={confirming}
        onClose={cancel}
        onConfirm={confirm}
        title="Log out?"
        message="You'll need to sign in again to get back in."
        confirmLabel="Log Out"
        tone="danger"
        loading={loading}
        icon={LogOut}
      />
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
        disabledOffline={item.disabledOffline}
      />
    )
  }

  // Collapsed: icon that reveals the child links in a hover flyout.
  if (collapsed) {
    return <CollapsedGroup item={item} pathname={pathname} childActive={childActive} />
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
              disabledOffline={c.disabledOffline}
              nested
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Collapsed-sidebar nav group: icon trigger + hover flyout with the child links. */
function CollapsedGroup({
  item,
  pathname,
  childActive,
}: {
  item: NavItem
  pathname: string
  childActive: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.top, left: r.right + 8 })
    setOpen(true)
  }
  const scheduleHide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }
  React.useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocusCapture={show}
      onBlurCapture={scheduleHide}
    >
      <SidebarLink
        href={item.children![0].href}
        icon={item.icon}
        label={item.label}
        active={childActive}
        collapsed
      />
      {open && (
        <div
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 min-w-52 rounded-md border border-shell-border bg-shell p-1.5 shadow-pop"
        >
          <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">
            {item.label}
          </p>
          {item.children!.map((c) => (
            <SidebarLink
              key={c.href}
              href={c.href}
              icon={c.icon}
              label={c.label}
              active={isActive(pathname, c.href, c.exact)}
              collapsed={false}
              disabledOffline={c.disabledOffline}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Middleware re-verifies auth + the single-session lock on every navigation
// (proxy.ts), which is a couple of real network round trips — slow enough,
// given the Supabase region, that tapping a link can otherwise look like it
// did nothing until the destination actually loads. useLinkStatus() reports
// this specific link's in-flight state client-side, independent of how long
// that server round trip takes, so a tap gets instant visual feedback. Must
// be a child of <Link>, not the Link itself — that's a Next.js requirement.
function LinkPendingIndicator({ collapsed }: { collapsed: boolean }) {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        "shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white",
        collapsed ? "absolute right-1 top-1 h-2.5 w-2.5" : "h-3.5 w-3.5",
      )}
    />
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
  disabledOffline,
}: {
  href: string
  icon: LucideIcon
  label: string
  badge?: number
  active: boolean
  collapsed: boolean
  nested?: boolean
  disabledOffline?: boolean
}) {
  const isOnline = React.useContext(SidebarOnlineContext)
  // Lock data-only pages while offline — unless you're already on one (it was
  // cached), where re-navigating to yourself is harmless.
  const locked = !!disabledOffline && !isOnline && !active

  if (locked) {
    return (
      <div
        aria-disabled="true"
        title={collapsed ? `${label} — available when you're back online` : "Available when you're back online"}
        className={cn(
          "group relative flex items-center gap-3 rounded-sm px-3 text-sm font-medium",
          nested ? "py-2" : "py-2.5",
          collapsed ? "justify-center px-0" : "",
          "cursor-not-allowed text-white/30",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed ? (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <WifiOff className="absolute right-1 top-1 h-2.5 w-2.5" />
        )}
      </div>
    )
  }

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
      <LinkPendingIndicator collapsed={collapsed} />
    </Link>
  )
}
