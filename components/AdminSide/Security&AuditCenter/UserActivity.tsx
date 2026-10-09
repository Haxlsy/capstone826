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
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { FieldLabel } from "@/components/ui/Field"

export default function UserActivity() {
    const toast = useToast()
    const [actRoleFilter,   setActRoleFilter]   = useState<AuditRole | "all">("all")
    const [actCatFilter,    setActCatFilter]    = useState<AuditCategory | "all">("all")
    const [actPeriodFilter, setActPeriodFilter] = useState<TimePeriod>("all")
    const [actDateFrom,     setActDateFrom]     = useState("")
    const [actDateTo,       setActDateTo]       = useState("")
    const [actPageSize,     setActPageSize]     = useState<PageSize>(10)
    const [actPage,         setActPage]         = useState(1)
    const [pendingDateFrom, setPendingDateFrom] = useState("")
    const [pendingDateTo,   setPendingDateTo]   = useState("")
    const [sortBy,          setSortBy]          = useState<AuditSortColumn>("created_at")
    const [sortDir,         setSortDir]         = useState<"asc" | "desc">("desc")
    const [exportConfirm,   setExportConfirm]   = useState<"pdf" | "excel" | null>(null)
    const [exporting,       setExporting]       = useState(false)

    const params = {
      scope: "activity" as const, role: actRoleFilter, category: actCatFilter, action: "all" as const,
      period: actPeriodFilter, dateFrom: actDateFrom || null, dateTo: actDateTo || null,
      sortBy, sortDir, page: actPage, pageSize: actPageSize,
    }
    const { logs: actEntries, total, loading, refreshing, fetchErr, reload } = useAuditLogs(params)

    function handleSort(column: AuditSortColumn) {
      const next = toggleSort({ sortBy, sortDir }, column)
      setSortBy(next.sortBy)
      setSortDir(next.sortDir)
      setActPage(1)
    }

    function handleApplyFilters() {
      setActDateFrom(pendingDateFrom)
      setActDateTo(pendingDateTo)
      if (pendingDateFrom || pendingDateTo) setActPeriodFilter("all")
      setActPage(1)
    }

    function handleResetDateFilter() {
      setPendingDateFrom("")
      setPendingDateTo("")
      setActDateFrom("")
      setActDateTo("")
      setActPage(1)
    }

    const dateRangeNote =
      actDateFrom && actDateTo ? `${actDateFrom} – ${actDateTo}`
      : actDateFrom            ? `from ${actDateFrom}`
      : actDateTo              ? `through ${actDateTo}`
      : null

    const filterNote = [
      actRoleFilter !== "all" ? ROLE_LABEL[actRoleFilter] : null,
      actCatFilter !== "all" ? actCatFilter : null,
      dateRangeNote ?? (actPeriodFilter !== "all" ? actPeriodFilter : null),
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

    const OLD_SELECT_CLS = "text-xs border border-border rounded-sm px-2.5 py-1.5 bg-surface text-body focus:outline-none focus:ring-2 focus:ring-gray-200"
    const DATE_INPUT_CLS = "h-10 rounded-sm border border-border bg-surface px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
    return (
        <div className="flex flex-col gap-5">
        <Card className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <FieldLabel>From</FieldLabel>
              <input type="date" title="Show entries on or after this date"
                value={pendingDateFrom} max={pendingDateTo || undefined}
                onChange={(e) => setPendingDateFrom(e.target.value)}
                className={DATE_INPUT_CLS}
              />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <input type="date" title="Show entries on or before this date"
                value={pendingDateTo} min={pendingDateFrom || undefined}
                onChange={(e) => setPendingDateTo(e.target.value)}
                className={DATE_INPUT_CLS}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleApplyFilters}>Apply Filters</Button>
              <Button variant="ghost" onClick={handleResetDateFilter}>Reset</Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setExportConfirm("pdf")}>
              <FileText className="h-4 w-4" /> Export PDF
            </Button>
            <Button variant="secondary" onClick={() => setExportConfirm("excel")}>
              <FileSpreadsheet className="h-4 w-4" /> Export Excel
            </Button>
          </div>
        </Card>

        <Card className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4 pb-4 border-b border-border-subtle">
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
            <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
            <select aria-label="Role filter" title="Filter by the user's role" value={actRoleFilter}
              onChange={(e) => { setActRoleFilter(e.target.value as AuditRole | "all"); setActPage(1) }}
              className={OLD_SELECT_CLS}
            >
              <option value="all">All roles</option>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <select aria-label="Action filter" title="Filter by action type" value={actCatFilter}
              onChange={(e) => { setActCatFilter(e.target.value as AuditCategory | "all"); setActPage(1) }}
              className={OLD_SELECT_CLS}
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
            <select aria-label="Period filter"
              title={actDateFrom || actDateTo
                ? "Unavailable while a specific date range is set"
                : "Filter by a preset time range"}
              value={actPeriodFilter}
              disabled={!!actDateFrom || !!actDateTo}
              onChange={(e) => {
                setActPeriodFilter(e.target.value as TimePeriod)
                setActDateFrom(""); setActDateTo("")
                setPendingDateFrom(""); setPendingDateTo("")
                setActPage(1)
              }}
              className={`${OLD_SELECT_CLS} disabled:opacity-50 disabled:cursor-not-allowed`}
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
        </Card>

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
