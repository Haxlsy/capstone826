"use client"

import { useState, useEffect, useCallback } from "react"
import {
  LogIn, Eye, Plus, RefreshCw, CheckCircle2, AlertTriangle,
  MessageSquare, Trash2, Filter, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

type AuditRole =
  | "super_admin"
  | "admin"
  | "operations"
  | "sales"
  | "head_detailer"
  | "head_installer"

type AuditCategory =
  | "auth"
  | "view"
  | "create"
  | "update"
  | "approve"
  | "flag"
  | "delete"
  | "message"

interface AuditEntry {
  id:          string
  user:        string
  role:        AuditRole
  category:    AuditCategory
  action:      string
  target:      string     // e.g. job ID, account name, service name
  timestamp:   string     // ISO string
}

// ── Static audit data ─────────────────────────────────────────────────────────

const AUDIT_ENTRIES: AuditEntry[] = [
  // Super Admin
  {
    id: "a1",
    user: "Maria Santos",
    role: "super_admin",
    category: "auth",
    action: "Logged in",
    target: "Admin Panel",
    timestamp: "2026-04-15T08:02:11Z",
  },
  {
    id: "a2",
    user: "Maria Santos",
    role: "super_admin",
    category: "create",
    action: "Created account",
    target: "Juan dela Cruz (Operations)",
    timestamp: "2026-04-15T08:10:45Z",
  },
  {
    id: "a3",
    user: "Maria Santos",
    role: "super_admin",
    category: "update",
    action: "Updated service",
    target: "Full Detail Package",
    timestamp: "2026-04-15T08:25:30Z",
  },
  {
    id: "a4",
    user: "Maria Santos",
    role: "super_admin",
    category: "delete",
    action: "Archived account",
    target: "Pedro Reyes (Sales)",
    timestamp: "2026-04-15T09:00:00Z",
  },
  // Admin
  {
    id: "a5",
    user: "Carlo Mendoza",
    role: "admin",
    category: "auth",
    action: "Logged in",
    target: "Admin Panel",
    timestamp: "2026-04-15T08:05:20Z",
  },
  {
    id: "a6",
    user: "Carlo Mendoza",
    role: "admin",
    category: "create",
    action: "Added service",
    target: "Engine Bay Cleaning",
    timestamp: "2026-04-15T08:30:00Z",
  },
  {
    id: "a7",
    user: "Carlo Mendoza",
    role: "admin",
    category: "view",
    action: "Viewed account list",
    target: "Account Management",
    timestamp: "2026-04-15T08:45:00Z",
  },
  {
    id: "a8",
    user: "Carlo Mendoza",
    role: "admin",
    category: "update",
    action: "Updated chatbot knowledge",
    target: "FAQ — Booking Process",
    timestamp: "2026-04-15T09:10:00Z",
  },
  // Operations
  {
    id: "a9",
    user: "Ana Reyes",
    role: "operations",
    category: "auth",
    action: "Logged in",
    target: "Operations Dashboard",
    timestamp: "2026-04-15T07:58:00Z",
  },
  {
    id: "a10",
    user: "Ana Reyes",
    role: "operations",
    category: "create",
    action: "Created job order",
    target: "JO-2026-4B2A · ABC 123",
    timestamp: "2026-04-15T08:15:00Z",
  },
  {
    id: "a11",
    user: "Ana Reyes",
    role: "operations",
    category: "update",
    action: "Updated job status",
    target: "JO-2026-4B2A → Ongoing",
    timestamp: "2026-04-15T08:20:00Z",
  },
  {
    id: "a12",
    user: "Ana Reyes",
    role: "operations",
    category: "flag",
    action: "Flagged stage for rework",
    target: "JO-2026-4B2A · Stage: Pre-wash",
    timestamp: "2026-04-15T10:05:00Z",
  },
  {
    id: "a13",
    user: "Ana Reyes",
    role: "operations",
    category: "approve",
    action: "Marked job as Released",
    target: "JO-2026-3C1D · XYZ 789",
    timestamp: "2026-04-15T11:00:00Z",
  },
  {
    id: "a14",
    user: "Ana Reyes",
    role: "operations",
    category: "update",
    action: "Resent stage update",
    target: "JO-2026-4B2A · Stage: Clay Bar",
    timestamp: "2026-04-15T11:30:00Z",
  },
  {
    id: "a15",
    user: "Ana Reyes",
    role: "operations",
    category: "view",
    action: "Viewed job order detail",
    target: "JO-2026-4B2A",
    timestamp: "2026-04-15T12:00:00Z",
  },
  // Sales
  {
    id: "a16",
    user: "Liza Cruz",
    role: "sales",
    category: "auth",
    action: "Logged in",
    target: "Sales Dashboard",
    timestamp: "2026-04-15T08:00:00Z",
  },
  {
    id: "a17",
    user: "Liza Cruz",
    role: "sales",
    category: "create",
    action: "Recorded new inquiry",
    target: "Jose Bautista · Full Detail",
    timestamp: "2026-04-15T08:35:00Z",
  },
  {
    id: "a18",
    user: "Liza Cruz",
    role: "sales",
    category: "approve",
    action: "Confirmed booking inquiry",
    target: "Inquiry #INQ-0042",
    timestamp: "2026-04-15T09:15:00Z",
  },
  {
    id: "a19",
    user: "Liza Cruz",
    role: "sales",
    category: "update",
    action: "Edited customer record",
    target: "Maricel Torres · Plate: DEF 456",
    timestamp: "2026-04-15T09:45:00Z",
  },
  {
    id: "a20",
    user: "Liza Cruz",
    role: "sales",
    category: "view",
    action: "Viewed customer records",
    target: "Customer Records",
    timestamp: "2026-04-15T10:00:00Z",
  },
  {
    id: "a21",
    user: "Liza Cruz",
    role: "sales",
    category: "message",
    action: "Replied to Messenger inquiry",
    target: "Conversation #CONV-0091",
    timestamp: "2026-04-15T10:20:00Z",
  },
  // Head Detailer
  {
    id: "a22",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "auth",
    action: "Logged in",
    target: "Technician App",
    timestamp: "2026-04-15T07:50:00Z",
  },
  {
    id: "a23",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "update",
    action: "Started job",
    target: "JO-2026-4B2A",
    timestamp: "2026-04-15T08:00:00Z",
  },
  {
    id: "a24",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "approve",
    action: "Marked stage as done",
    target: "JO-2026-4B2A · Stage: Pre-wash",
    timestamp: "2026-04-15T09:30:00Z",
  },
  {
    id: "a25",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "approve",
    action: "Marked stage as done",
    target: "JO-2026-4B2A · Stage: Clay Bar",
    timestamp: "2026-04-15T10:15:00Z",
  },
  {
    id: "a26",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "flag",
    action: "Flagged preparation for rework",
    target: "JO-2026-4B2A · Stage: Polish",
    timestamp: "2026-04-15T11:00:00Z",
  },
  {
    id: "a27",
    user: "Rodel Navarro",
    role: "head_detailer",
    category: "approve",
    action: "Approved preparation",
    target: "JO-2026-4B2A",
    timestamp: "2026-04-15T13:00:00Z",
  },
  // Head Installer
  {
    id: "a28",
    user: "Marco Villanueva",
    role: "head_installer",
    category: "auth",
    action: "Logged in",
    target: "Technician App",
    timestamp: "2026-04-15T08:05:00Z",
  },
  {
    id: "a29",
    user: "Marco Villanueva",
    role: "head_installer",
    category: "view",
    action: "Viewed job detail",
    target: "JO-2026-4B2A",
    timestamp: "2026-04-15T08:10:00Z",
  },
]

// ── Config ────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<AuditRole, string> = {
  super_admin:    "Super Admin",
  admin:          "Admin",
  operations:     "Operations",
  sales:          "Sales",
  head_detailer:  "Head Detailer",
  head_installer: "Head Installer",
}

const ROLE_BADGE: Record<AuditRole, string> = {
  super_admin:    "bg-purple-100 text-purple-700 border border-purple-200",
  admin:          "bg-indigo-100 text-indigo-700 border border-indigo-200",
  operations:     "bg-blue-100 text-blue-700 border border-blue-200",
  sales:          "bg-teal-100 text-teal-700 border border-teal-200",
  head_detailer:  "bg-orange-100 text-orange-700 border border-orange-200",
  head_installer: "bg-yellow-100 text-yellow-700 border border-yellow-200",
}

const CATEGORY_ICON: Record<AuditCategory, React.ReactNode> = {
  auth:    <LogIn       className="w-3.5 h-3.5" />,
  view:    <Eye         className="w-3.5 h-3.5" />,
  create:  <Plus        className="w-3.5 h-3.5" />,
  update:  <RefreshCw   className="w-3.5 h-3.5" />,
  approve: <CheckCircle2 className="w-3.5 h-3.5" />,
  flag:    <AlertTriangle className="w-3.5 h-3.5" />,
  delete:  <Trash2      className="w-3.5 h-3.5" />,
  message: <MessageSquare className="w-3.5 h-3.5" />,
}

const CATEGORY_COLOR: Record<AuditCategory, string> = {
  auth:    "text-gray-500  bg-gray-100",
  view:    "text-blue-500  bg-blue-50",
  create:  "text-emerald-600 bg-emerald-50",
  update:  "text-blue-600  bg-blue-100",
  approve: "text-green-600 bg-green-50",
  flag:    "text-orange-600 bg-orange-50",
  delete:  "text-red-600   bg-red-50",
  message: "text-teal-600  bg-teal-50",
}

const ALL_ROLES: AuditRole[] = [
  "super_admin", "admin", "operations", "sales", "head_detailer", "head_installer",
]

// ── Helpers ───────────────────────────────────────────────────────────────────

type TimePeriod = "week" | "month" | "all"

function startOfPeriod(period: TimePeriod): Date | null {
  if (period === "all") return null
  const now = new Date()
  if (period === "week") {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay()) // Sunday
    d.setHours(0, 0, 0, 0)
    return d
  }
  // month
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  })
}

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 15, 20] as const
type PageSize = typeof PAGE_SIZE_OPTIONS[number]

interface ApiLog {
  id:         string
  user_id:    string | null
  user_name:  string
  role:       string
  category:   string
  action:     string
  target:     string
  created_at: string
}

export default function AuditLog() {
  // Login/Logout table filters
  const [authRoleFilter,   setAuthRoleFilter]   = useState<AuditRole | "all">("all")
  const [authEventFilter,  setAuthEventFilter]  = useState<string>("all")
  const [authPeriodFilter, setAuthPeriodFilter] = useState<TimePeriod>("all")
  const [authPageSize,     setAuthPageSize]     = useState<PageSize>(10)
  const [authPage,         setAuthPage]         = useState(1)

  // Audit Trail table filters
  const [actRoleFilter,   setActRoleFilter]   = useState<AuditRole | "all">("all")
  const [actCatFilter,    setActCatFilter]    = useState<AuditCategory | "all">("all")
  const [actPeriodFilter, setActPeriodFilter] = useState<TimePeriod>("all")
  const [actPageSize,     setActPageSize]     = useState<PageSize>(10)
  const [actPage,         setActPage]         = useState(1)

  const [logs,    setLogs]    = useState<ApiLog[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchErr(null)
    try {
      const res  = await fetch("/api/admin/audit-log?limit=500")
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load audit log")
      setLogs(json.logs ?? [])
    } catch (err: unknown) {
      setFetchErr(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Split: login/logout only vs everything else (including password reset)
  const authAll = sorted.filter((e) => e.action === "Logged in" || e.action === "Logged out")
  const actAll  = sorted.filter((e) => e.action !== "Logged in" && e.action !== "Logged out")

  // Apply filters per table
  const authPeriodStart = startOfPeriod(authPeriodFilter)
  const filteredAuth = authAll
    .filter((e) => authRoleFilter   === "all" || e.role   === authRoleFilter)
    .filter((e) => authEventFilter  === "all" || e.action === authEventFilter)
    .filter((e) => !authPeriodStart || new Date(e.created_at) >= authPeriodStart)

  const actPeriodStart = startOfPeriod(actPeriodFilter)
  const filteredAct = actAll
    .filter((e) => actRoleFilter  === "all" || e.role     === actRoleFilter)
    .filter((e) => actCatFilter   === "all" || e.category === actCatFilter)
    .filter((e) => !actPeriodStart || new Date(e.created_at) >= actPeriodStart)

  // Auth pagination
  const authTotalPages = Math.max(1, Math.ceil(filteredAuth.length / authPageSize))
  const authSafePage   = Math.min(authPage, authTotalPages)
  const authStart      = (authSafePage - 1) * authPageSize
  const authEntries    = filteredAuth.slice(authStart, authStart + authPageSize)

  // Activity pagination
  const actTotalPages = Math.max(1, Math.ceil(filteredAct.length / actPageSize))
  const actSafePage   = Math.min(actPage, actTotalPages)
  const actStart      = (actSafePage - 1) * actPageSize
  const actEntries    = filteredAct.slice(actStart, actStart + actPageSize)

  const SELECT_CLS = "text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"

  function renderRow(entry: ApiLog, showTarget: boolean) {
    const role     = entry.role     as AuditRole
    const category = entry.category as AuditCategory
    return (
      <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
        <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">{fmtTime(entry.created_at)}</td>
        <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{entry.user_name}</td>
        <td className="py-3 pr-4">
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}>
            {ROLE_LABEL[role] ?? entry.role}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${CATEGORY_COLOR[category] ?? "text-gray-600 bg-gray-100"}`}>
            {CATEGORY_ICON[category] ?? null}
            {entry.action}
          </span>
        </td>
        {showTarget && (
          <td className="py-3 text-xs text-gray-500 font-mono">{entry.target || "—"}</td>
        )}
      </tr>
    )
  }

  function PaginationBar({
    total, pageSize, setPageSize, page, setPage,
  }: {
    total: number; pageSize: PageSize; setPageSize: (s: PageSize) => void
    page: number; setPage: (fn: (p: number) => number) => void
  }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const safePg     = Math.min(page, totalPages)
    const start      = total === 0 ? 0 : (safePg - 1) * pageSize + 1
    const end        = Math.min((safePg - 1) * pageSize + pageSize, total)
    return (
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 gap-4 flex-wrap">
        <p className="text-xs text-gray-400">
          {total === 0 ? "No entries" : `Showing ${start}–${end} of ${total} entries`}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Rows per page:</span>
            <div className="flex items-center gap-1">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button key={size} type="button"
                  onClick={() => { setPageSize(size as PageSize); setPage(() => 1) }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${pageSize === size ? "bg-gray-900 text-white" : "text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePg === 1}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>
            <span className="text-xs text-gray-500 min-w-15 text-center">Page {safePg} of {totalPages}</span>
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePg === totalPages}
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Table 1: Login / Logout Attempts ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-800">Login / Logout Attempts</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Auth events · {loading ? "…" : `${filteredAuth.length} entries`}
              </p>
            </div>
            <button type="button" onClick={load} disabled={loading} title="Refresh"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select aria-label="Role filter" value={authRoleFilter}
              onChange={(e) => { setAuthRoleFilter(e.target.value as AuditRole | "all"); setAuthPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All roles</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <select aria-label="Event filter" value={authEventFilter}
              onChange={(e) => { setAuthEventFilter(e.target.value); setAuthPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All events</option>
              <option value="Logged in">Logged in</option>
              <option value="Logged out">Logged out</option>
            </select>
            <select aria-label="Period filter" value={authPeriodFilter}
              onChange={(e) => { setAuthPeriodFilter(e.target.value as TimePeriod); setAuthPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Time", "User", "Role", "Event"].map((h) => (
                  <th key={h} className="text-left pb-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="py-12 text-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin mx-auto" /></td></tr>
              ) : fetchErr ? (
                <tr><td colSpan={4} className="py-10 text-center text-sm text-red-500">{fetchErr}</td></tr>
              ) : authEntries.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-sm text-gray-400">No entries match the selected filters.</td></tr>
              ) : authEntries.map((e) => renderRow(e, false))}
            </tbody>
          </table>
        </div>
        <PaginationBar total={filteredAuth.length} pageSize={authPageSize} setPageSize={setAuthPageSize} page={authPage} setPage={setAuthPage} />
      </div>

      {/* ── Table 2: User Activity ────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Audit Trail</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              User activity · {loading ? "…" : `${filteredAct.length} entries`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <select aria-label="Role filter" value={actRoleFilter}
              onChange={(e) => { setActRoleFilter(e.target.value as AuditRole | "all"); setActPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All roles</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <select aria-label="Action filter" value={actCatFilter}
              onChange={(e) => { setActCatFilter(e.target.value as AuditCategory | "all"); setActPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All actions</option>
              <option value="auth">Password reset</option>
              <option value="view">View</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="approve">Approve</option>
              <option value="flag">Flag / Rework</option>
              <option value="delete">Delete / Archive</option>
              <option value="message">Message</option>
            </select>
            <select aria-label="Period filter" value={actPeriodFilter}
              onChange={(e) => { setActPeriodFilter(e.target.value as TimePeriod); setActPage(1) }}
              className={SELECT_CLS}
            >
              <option value="all">All time</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Time", "User", "Role", "Action", "Target"].map((h) => (
                  <th key={h} className="text-left pb-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-5 h-5 text-gray-300 animate-spin mx-auto" /></td></tr>
              ) : fetchErr ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-red-500">{fetchErr}</td></tr>
              ) : actEntries.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-gray-400">No activity entries.</td></tr>
              ) : actEntries.map((e) => renderRow(e, true))}
            </tbody>
          </table>
        </div>
        <PaginationBar total={filteredAct.length} pageSize={actPageSize} setPageSize={setActPageSize} page={actPage} setPage={setActPage} />
      </div>
    </div>
  )
}
