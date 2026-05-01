export type AuditRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "sales"
  | "head_detailer"
  | "head_installer"

export type AuditCategory =
  | "auth"
  | "view"
  | "create"
  | "update"
  | "approve"
  | "flag"
  | "delete"
  | "message"

export interface AuditEntry {
  id:          string
  user:        string
  role:        AuditRole
  category:    AuditCategory
  action:      string
  target:      string     // e.g. job ID, account name, service name
  timestamp:   string     // ISO string
}

export type TimePeriod = "week" | "month" | "all"

export type PageSize = 10 | 15 | 20 | 100

export interface ApiLog {
  id:         string
  user_id:    string | null
  user_name:  string
  role:       string
  category:   string
  action:     string
  target:     string
  created_at: string
}