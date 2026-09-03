import { AuditCategory, AuditRole } from "../../../types/audit"
import  { LogIn, Eye, Plus, RefreshCw, CheckCircle2, AlertTriangle,
  MessageSquare, Trash2 } from "lucide-react"

export const ROLE_LABEL: Record<AuditRole, string> = {
  super_admin:    "Super Admin",
  admin:          "Admin",
  operations:     "Operations",
  sales:          "Sales",
  head_detailer:  "Head Detailer",
  head_installer: "Head Installer",
}

export const ROLE_BADGE: Record<AuditRole, string> = {
  super_admin:    "bg-status-concern/12 text-status-concern border border-status-concern/30",
  admin:          "bg-status-ongoing/12 text-status-ongoing border border-status-ongoing/30",
  operations:     "bg-primary/12 text-primary border border-primary/30",
  sales:          "bg-status-release/12 text-status-release border border-status-release/30",
  head_detailer:  "bg-status-rework/12 text-status-rework border border-status-rework/30",
  head_installer: "bg-status-warning/12 text-status-warning border border-status-warning/30",
}

export const CATEGORY_ICON: Record<AuditCategory, React.ReactNode> = {
  auth:    <LogIn       className="w-3.5 h-3.5" />,
  view:    <Eye         className="w-3.5 h-3.5" />,
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
  create:  "text-status-inspection bg-status-inspection/10",
  update:  "text-primary  bg-primary/12",
  approve: "text-status-inspection bg-status-inspection/10",
  flag:    "text-status-rework bg-status-rework/10",
  delete:  "text-status-delayed   bg-status-delayed/10",
  message: "text-status-release  bg-status-release/10",
}