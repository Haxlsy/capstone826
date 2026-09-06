"use client"
import {Filter, Loader2} from "lucide-react"
import {AuditRole, TimePeriod, PageSize, AuditCategory} from "../../../types/audit"
import {ROLE_LABEL, ALL_ROLES} from "../Constants/config"
import PaginationBar from "./PaginationBar"
import { startOfPeriod} from "@/hooks/audit-helpers"
import renderRow from "./renderRow"
import { useAuditLogs } from "@/hooks/use-audit-logs"
import { useState } from "react"

export default function UserActivity({ initialLogs }: { initialLogs: any[] }){
    const [actRoleFilter,   setActRoleFilter]   = useState<AuditRole | "all">("all")
    const [actCatFilter,    setActCatFilter]    = useState<AuditCategory | "all">("all")
    const [actPeriodFilter, setActPeriodFilter] = useState<TimePeriod>("all")
    const [actPageSize,     setActPageSize]     = useState<PageSize>(10)
    const [actPage,         setActPage]         = useState(1)

    const { logs, loading, fetchErr } = useAuditLogs(initialLogs)
    const sorted = [...logs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const actAll  = sorted.filter((e) => e.action !== "Logged in" && e.action !== "Logged out")
    const actPeriodStart = startOfPeriod(actPeriodFilter)

    const filteredAct = actAll
    .filter((e) => actRoleFilter  === "all" || e.role     === actRoleFilter)
    .filter((e) => actCatFilter   === "all" || e.category === actCatFilter)
    .filter((e) => !actPeriodStart || new Date(e.created_at) >= actPeriodStart)

    const actTotalPages = Math.max(1, Math.ceil(filteredAct.length / actPageSize))
    const actSafePage   = Math.min(actPage, actTotalPages)
    const actStart      = (actSafePage - 1) * actPageSize
    const actEntries    = filteredAct.slice(actStart, actStart + actPageSize)

    const SELECT_CLS = "text-xs border border-border rounded-sm px-2.5 py-1.5 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-gray-200"    
    return (
        <div className="bg-surface rounded-card border border-border-subtle p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-heading">Audit Trail</h2>
            <p className="text-xs text-muted mt-0.5">
              User activity · {loading ? "…" : `${filteredAct.length} entries`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
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
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                {["Time", "User", "Role", "Action", "Target"].map((h) => (
                  <th key={h} className="text-left pb-2.5 text-xs font-semibold text-muted uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center"><Loader2 className="w-5 h-5 text-muted animate-spin mx-auto" /></td></tr>
              ) : fetchErr ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-status-delayed">{fetchErr}</td></tr>
              ) : actEntries.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">No activity entries.</td></tr>
              ) : actEntries.map((e) => renderRow(e, true))}
            </tbody>
          </table>
        </div>
        <PaginationBar total={filteredAct.length} pageSize={actPageSize} setPageSize={setActPageSize} page={actPage} setPage={setActPage} />
      </div>
    )
}
