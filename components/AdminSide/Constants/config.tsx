import { AuditCategory, AuditRole } from "../../../types/audit"
import  { LogIn, Eye, Download, Plus, RefreshCw, CheckCircle2, AlertTriangle,
  MessageSquare, Trash2 } from "lucide-react"
import { roleStyle, roleLabel } from "@/lib/ui/roles"

/** @deprecated use `roleLabel()` from `@/lib/ui/roles` */
export const ROLE_LABEL: Record<AuditRole, string> = {
  super_admin:    roleLabel("super_admin"),
  admin:          roleLabel("admin"),
  operations:     roleLabel("operations"),
  sales:          roleLabel("sales"),
  head_detailer:  roleLabel("head_detailer"),
  head_installer: roleLabel("head_installer"),
}

/** @deprecated use `roleStyle().badge` from `@/lib/ui/roles` */
export const ROLE_BADGE: Record<AuditRole, string> = {
  super_admin:    roleStyle("super_admin").badge,
  admin:          roleStyle("admin").badge,
  operations:     roleStyle("operations").badge,
  sales:          roleStyle("sales").badge,
  head_detailer:  roleStyle("head_detailer").badge,
  head_installer: roleStyle("head_installer").badge,
}

export const CATEGORY_ICON: Record<AuditCategory, React.ReactNode> = {
  auth:    <LogIn       className="w-3.5 h-3.5" />,
  view:    <Eye         className="w-3.5 h-3.5" />,
  export:  <Download    className="w-3.5 h-3.5" />,
  create:  <Plus        className="w-3.5 h-3.5" />,
  update:  <RefreshCw   className="w-3.5 h-3.5" />,
  approve: <CheckCircle2 className="w-3.5 h-3.5" />,
  flag:    <AlertTriangle className="w-3.5 h-3.5" />,
  delete:  <Trash2      className="w-3.5 h-3.5" />,
  message: <MessageSquare className="w-3.5 h-3.5" />,
}

export const ALL_ROLES: AuditRole[] = [
  "super_admin", "admin", "operations", "sales", "head_detailer", "head_installer",
]

export const CATEGORY_COLOR: Record<AuditCategory, string> = {
  auth:    "text-body  bg-surface-muted",
  view:    "text-primary  bg-primary/10",
  export:  "text-status-ongoing  bg-status-ongoing/10",
  create:  "text-status-inspection bg-status-inspection/10",
  update:  "text-primary  bg-primary/12",
  approve: "text-status-inspection bg-status-inspection/10",
  flag:    "text-status-rework bg-status-rework/10",
  delete:  "text-status-delayed   bg-status-delayed/10",
  message: "text-status-release  bg-status-release/10",
}