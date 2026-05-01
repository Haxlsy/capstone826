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
  super_admin:    "bg-purple-100 text-purple-700 border border-purple-200",
  admin:          "bg-indigo-100 text-indigo-700 border border-indigo-200",
  operations:     "bg-blue-100 text-blue-700 border border-blue-200",
  sales:          "bg-teal-100 text-teal-700 border border-teal-200",
  head_detailer:  "bg-orange-100 text-orange-700 border border-orange-200",
  head_installer: "bg-yellow-100 text-yellow-700 border border-yellow-200",
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
  auth:    "text-gray-500  bg-gray-100",
  view:    "text-blue-500  bg-blue-50",
  create:  "text-emerald-600 bg-emerald-50",
  update:  "text-blue-600  bg-blue-100",
  approve: "text-green-600 bg-green-50",
  flag:    "text-orange-600 bg-orange-50",
  delete:  "text-red-600   bg-red-50",
  message: "text-teal-600  bg-teal-50",
}