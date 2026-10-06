"use client"
import { useState } from "react"
import { Filter, Loader2, FileText, FileSpreadsheet, RefreshCw } from "lucide-react"
import { AuditRole, TimePeriod, PageSize, AuditCategory } from "../../../types/audit"
import { ROLE_LABEL, ALL_ROLES } from "../Constants/config"
import PaginationBar from "./PaginationBar"
import SortableTh from "./SortableTh"
import renderRow from "./renderRow"
import { useAuditLogs, fetchAllAuditLogs } from "@/hooks/use-audit-logs"
import { toggleSort, type AuditSortColumn } from "@/lib/admin/audit-log-query"
import { buildCsv, downloadCsv, openPrintPreview } from "@/lib/export/print"
import { exportHeaders, toCsvCells, exportFilename, buildPrintHtml } from "@/lib/admin/audit-log-export"
import { logExport } from "@/lib/client/log-export"
import { ConfirmModal } from "@/components/ui/Modal"
import { useToast } from "@/components/ui/Toast"

export default function UserActivity() {
    const toast = useToast()
    const [actRoleFilter,   setActRoleFilter]   = useState<AuditRole | "all">("all")
    const [actCatFilter,    setActCatFilter]    = useState<AuditCategory | "all">("all")
    const [actPeriodFilter, setActPeriodFilter] = useState<TimePeriod>("all")
    const [actPageSize,     setActPageSize]     = useState<PageSize>(10)
    const [actPage,         setActPage]         = useState(1)
    const [sortBy,          setSortBy]          = useState<AuditSortColumn>("created_at")
    const [sortDir,         setSortDir]         = useState<"asc" | "desc">("desc")
    const [exportConfirm,   setExportConfirm]   = useState<"pdf" | "excel" | null>(null)
    const [exporting,       setExporting]       = useState(false)

    const params = {
      scope: "activity" as const, role: actRoleFilter, category: actCatFilter, action: "all" as const,
      period: actPeriodFilter, sortBy, sortDir, page: actPage, pageSize: actPageSize,
    }
    const { logs: actEntries, total, loading, refreshing, fetchErr, reload } = useAuditLogs(params)

    function handleSort(column: AuditSortColumn) {
      const next = toggleSort({ sortBy, sortDir }, column)
      setSortBy(next.sortBy)
      setSortDir(next.sortDir)
      setActPage(1)
    }

    const filterNote = [
      actRoleFilter !== "all" ? ROLE_LABEL[actRoleFilter] : null,
      actCatFilter !== "all" ? actCatFilter : null,
      actPeriodFilter !== "all" ? actPeriodFilter : null,
    ].filter(Boolean).join(", ") || null

    async function runExport(type: "pdf" | "excel") {
      setExporting(true)
      try {
        const all = await fetchAllAuditLogs(params)
        if (all.length === 0) {
          toast.error("Nothing to export.")
          return
        }
        const now = new Date()
        if (type === "excel") {
          downloadCsv(exportFilename("audit-trail", now), buildCsv([...exportHeaders(true)], all.map((e) => toCsvCells(e, true))))
          logExport("audit_trail_excel", filterNote ?? undefined)
        } else {
          openPrintPreview(buildPrintHtml("Audit Trail", all, true, new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }), filterNote))
          logExport("audit_trail_pdf", filterNote ?? undefined)
        }
        setExportConfirm(null)
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : String(err))
        setExportConfirm(null)
      } finally {
        setExporting(false)
      }
    }

    const SELECT_CLS = "text-xs border border-border rounded-sm px-2.5 py-1.5 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-gray-200"
    return (
        <div className="bg-surface rounded-card border border-border-subtle p-6">
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-heading">Audit Trail</h2>
              <p className="text-xs text-muted mt-0.5">
                User activity · {loading ? "…" : `${total} entries`}
              </p>
            </div>
            <button type="button" onClick={() => reload()} disabled={refreshing} title="Refresh"
              className="p-1.5 rounded-sm text-muted hover:text-body hover:bg-surface-muted transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setExportConfirm("pdf")}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-sm border border-border text-body hover:bg-surface-muted transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> Export PDF
            </button>
            <button type="button" onClick={() => setExportConfirm("excel")}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-sm border border-border text-body hover:bg-surface-muted transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </button>
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
              <option value="view">View</option>
              <option value="export">Export</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="approve">Approve</option>
              <option value="flag">Flag / Rework</option>
              <option value="delete">Delete / Archive</option>
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
                <SortableTh label="Time"   column="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} kind="time" />
                <SortableTh label="User"   column="user_name"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Role"   column="role"       sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Action" column="action"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <SortableTh label="Target" column="target"     sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
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
        <PaginationBar total={total} pageSize={actPageSize} setPageSize={setActPageSize} page={actPage} setPage={setActPage} />

        <ConfirmModal
          open={exportConfirm !== null}
          onClose={() => !exporting && setExportConfirm(null)}
          onConfirm={() => { if (exportConfirm) runExport(exportConfirm) }}
          title={exportConfirm === "excel" ? "Export as Excel" : "Export as PDF"}
          message={
            (filterNote ? `Export every audit trail entry matching ${filterNote}` : "Export the entire audit trail") +
            (exportConfirm === "excel" ? " to a CSV file that opens in Excel?" : "? This opens a print preview in a new tab.")
          }
          confirmLabel="Export"
          loading={exporting}
          icon={exportConfirm === "excel" ? FileSpreadsheet : FileText}
        />
      </div>
    )
}
