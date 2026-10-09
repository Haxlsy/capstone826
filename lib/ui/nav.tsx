import {
  LayoutDashboard,
  Briefcase,
  ClipboardList,
  Archive,
  UserCheck,
  AlertTriangle,
  MessageCircle,
  Users,
  AlertCircle,
  Wrench,
  Bot,
  ShieldHalf,
} from "lucide-react"
import type { NavItem } from "@/components/ui/AppSidebar"

export type NavArea = "operations" | "sales" | "admin"

export const OPERATIONS_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/operations", icon: LayoutDashboard, exact: true },
  {
    label: "Job Management",
    icon: Briefcase,
    children: [
      { label: "Job Order", href: "/dashboard/job-management", icon: ClipboardList },
      { label: "Job Records", href: "/dashboard/job-order-records", icon: Archive, disabledOffline: true },
      {
        label: "Technician Availability",
        href: "/dashboard/technician-availability",
        icon: UserCheck,
        disabledOffline: true,
      },
    ],
  },
  { label: "Concerns", href: "/dashboard/concerns", icon: AlertTriangle },
]

export const SALES_NAV: NavItem[] = [
  { label: "Inquiry Management", href: "/dashboard/sales", icon: MessageCircle, exact: true },
  { label: "Customer Records", href: "/dashboard/sales/customer-records", icon: Users, exact: true },
  { label: "View Job Orders", href: "/dashboard/sales/job-orders", icon: ClipboardList },
  { label: "View Concerns", href: "/dashboard/sales/concerns", icon: AlertCircle },
]

export const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard, exact: true },
  { label: "Account Management", href: "/dashboard/admin/accounts", icon: Users },
  { label: "Service Management", href: "/dashboard/admin/services", icon: Wrench },
  { label: "Security & Audit Center", href: "/dashboard/admin/security", icon: ShieldHalf },
  { label: "AI Configurations", href: "/dashboard/admin/chatbot", icon: Bot },
]

const OPERATIONS_PATHS = [
  "/dashboard/operations",
  "/dashboard/job-management",
  "/dashboard/concerns",
  "/dashboard/job-order-records",
  "/dashboard/technician-availability",
  "/dashboard/services",
]

export function resolveNavArea(pathname: string): NavArea {
  if (pathname.startsWith("/dashboard/admin")) return "admin"
  if (OPERATIONS_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return "operations"
  return "sales"
}

export function navFor(area: NavArea): {
  nav: NavItem[]
  fallbackName: string
  showBell: boolean
} {
  switch (area) {
    case "admin":
      // Admin/super-admin keep the previous (no-bell) top bar.
      return { nav: ADMIN_NAV, fallbackName: "Admin", showBell: false }
    case "operations":
      return { nav: OPERATIONS_NAV, fallbackName: "Operations", showBell: true }
    case "sales":
      return { nav: SALES_NAV, fallbackName: "Sales", showBell: true }
  }
}
