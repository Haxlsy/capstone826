"use client"

import { useState} from "react"
import {
 RefreshCw, Filter, Loader2
} from "lucide-react"
import {AuditRole, TimePeriod, PageSize} from "../../../types/audit"
import {ROLE_LABEL, ALL_ROLES} from "../Constants/config"
import PaginationBar from "./PaginationBar"
import { startOfPeriod} from "@/hooks/audit-helpers"
import renderRow from "./renderRow"
import { useAuditLogs } from "@/hooks/use-audit-logs"

export default function SecurityView({ initialLogs }: { initialLogs: any[] }) {
    const [authRoleFilter,   setAuthRoleFilter]   = useState<AuditRole | "all">("all")
    const [authEventFilter,  setAuthEventFilter]  = useState<string>("all")
    const [authPeriodFilter, setAuthPeriodFilter] = useState<TimePeriod>("all")
    const [authPageSize,     setAuthPageSize]     = useState<PageSize>(10)
    const [authPage,         setAuthPage]         = useState(1)
    const { logs, loading, fetchErr, reload }     = useAuditLogs(initialLogs)

    const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const authPeriodStart = startOfPeriod(authPeriodFilter)
    const authAll = sorted.filter((e) => e.action === "Logged in" || e.action === "Logged out")

     const filteredAuth = authAll
    .filter((e) => authRoleFilter   === "all" || e.role   === authRoleFilter)
    .filter((e) => authEventFilter  === "all" || e.action === authEventFilter)
    .filter((e) => !authPeriodStart || new Date(e.created_at) >= authPeriodStart)
    
    const authTotalPages = Math.max(1, Math.ceil(filteredAuth.length / authPageSize))
    const authSafePage   = Math.min(authPage, authTotalPages)
    const authStart      = (authSafePage - 1) * authPageSize
    const authEntries = filteredAuth.slice(authStart, authStart + authPageSize)
    
    const SELECT_CLS = "text-xs border border-border rounded-sm px-2.5 py-1.5 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-gray-200"
    return(
        <div>
            <div className="bg-surface rounded-card border border-border-subtle p-6">
                <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div>
                    <h2 className="text-base font-semibold text-heading">Login / Logout Attempts</h2>
                    <p className="text-xs text-muted mt-0.5">
                        Auth events · {loading ? "…" : `${filteredAuth.length} entries`}
                    </p>
                    </div>
                    <button type="button" onClick={reload} disabled={loading} title="Refresh"
                    className="p-1.5 rounded-sm text-muted hover:text-body hover:bg-surface-muted transition-colors disabled:opacity-40"
                    >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
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
                <div className="overflow-x-auto overflow-y-hidden">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="border-b border-border-subtle">
                        {["Time", "User", "Role", "Event"].map((h) => (
                        <th key={h} className="text-left pb-2.5 text-xs font-semibold text-muted uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                    {loading ? (
                        <tr><td colSpan={4} className="py-12 text-center"><Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" /></td></tr>
                    ) : fetchErr ? (
                        <tr><td colSpan={4} className="py-10 text-center text-sm text-status-delayed">{fetchErr}</td></tr>
                    ) : authEntries.length === 0 ? (
                        <tr><td colSpan={4} className="py-10 text-center text-sm text-muted">No entries match the selected filters.</td></tr>
                    ) : authEntries.map((e) => renderRow(e, false))}
                    </tbody>
                </table>
                </div>
                <PaginationBar total={filteredAuth.length} pageSize={authPageSize} setPageSize={setAuthPageSize} page={authPage} setPage={setAuthPage} />
            </div>
        </div>
    )
}
