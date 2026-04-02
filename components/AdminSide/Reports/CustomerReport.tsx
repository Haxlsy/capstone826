"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { FileText, Table, ChevronLeft, ChevronRight } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { exportToCSV, exportToPDF, formatDate } from "./ExportUtils"

interface CustomerRow {
  customer_id: number
  full_name: string
  contact_number: string
  email: string | null
  totalJobs: number
  lastServiceDate: string | null
}

interface FilterState {
  search: string
  startDate: string
  endDate: string
  serviceHistory: string // "all" | "has_jobs" | "no_jobs"
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

export default function CustomerReport() {
  const supabase = createClient()

  const [filters, setFilters] = useState<FilterState>({
    search: "", startDate: "", endDate: "", serviceHistory: "all",
  })
  const [applied, setApplied] = useState(filters)

  const [rows, setRows] = useState<CustomerRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  useEffect(() => { setPage(1) }, [applied, pageSize])
  useEffect(() => { fetchData() }, [applied, page, pageSize])

  async function fetchData() {
    setLoading(true)

    // Fetch job counts and last service date per customer
    const { data: jobData } = await supabase
      .from("job_order")
      .select("customer_id, created_at")

    const jobMap: Record<number, { count: number; lastDate: string }> = {}
    for (const j of jobData ?? []) {
      if (!jobMap[j.customer_id]) {
        jobMap[j.customer_id] = { count: 0, lastDate: j.created_at }
      }
      jobMap[j.customer_id].count++
      if (j.created_at > jobMap[j.customer_id].lastDate) {
        jobMap[j.customer_id].lastDate = j.created_at
      }
    }

    let q = supabase
      .from("customer")
      .select("customer_id, full_name, contact_number, email", { count: "exact" })
      .eq("is_archived", false)
      .order("full_name", { ascending: true })

    if (applied.search.trim()) {
      q = q.ilike("full_name", `%${applied.search.trim()}%`)
    }

    const from = (page - 1) * pageSize
    q = q.range(from, from + pageSize - 1)

    const { data, count, error } = await q
    if (!error) {
      let enriched: CustomerRow[] = (data ?? []).map((c) => ({
        ...c,
        totalJobs: jobMap[c.customer_id]?.count ?? 0,
        lastServiceDate: jobMap[c.customer_id]?.lastDate ?? null,
      }))

      // Filter by service history
      if (applied.serviceHistory === "has_jobs") {
        enriched = enriched.filter((c) => c.totalJobs > 0)
      } else if (applied.serviceHistory === "no_jobs") {
        enriched = enriched.filter((c) => c.totalJobs === 0)
      }

      // Filter by date range (last service date)
      if (applied.startDate) {
        enriched = enriched.filter(
          (c) => c.lastServiceDate && c.lastServiceDate >= `${applied.startDate}T00:00:00Z`
        )
      }
      if (applied.endDate) {
        enriched = enriched.filter(
          (c) => c.lastServiceDate && c.lastServiceDate <= `${applied.endDate}T23:59:59Z`
        )
      }

      setRows(enriched)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  function handleExportCSV() {
    const csvRows = rows.map((r) => ({
      "Customer Name": r.full_name,
      "Contact Number": r.contact_number,
      Email: r.email ?? "—",
      "Total Jobs": r.totalJobs,
      "Last Service Date": formatDate(r.lastServiceDate),
    }))
    exportToCSV(csvRows, "customer-report.csv")
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 print:p-0">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400">
        <Link href="/dashboard/admin/reports" className="hover:text-gray-600 transition-colors">Reports</Link>
        <span className="mx-1.5">›</span>
        <span className="text-gray-600 font-medium">Customer Reports</span>
      </nav>

      <h1 className="text-xl font-bold text-gray-800">Customer Reports</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 print:hidden">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Name Search</label>
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 w-44"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Start Date</label>
            <input type="date" value={filters.startDate}
              onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">End Date</label>
            <input type="date" value={filters.endDate}
              onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Service History</label>
            <select value={filters.serviceHistory}
              onChange={(e) => setFilters((p) => ({ ...p, serviceHistory: e.target.value }))}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none bg-white">
              <option value="all">All</option>
              <option value="has_jobs">Has Jobs</option>
              <option value="no_jobs">No Jobs</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setApplied(filters)}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
              Apply Filters
            </button>
            <button onClick={() => {
              const reset = { search: "", startDate: "", endDate: "", serviceHistory: "all" }
              setFilters(reset); setApplied(reset)
            }} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Summary + Export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? "Loading..." : (
            <>Showing <span className="font-semibold text-gray-800">{rows.length}</span> customers</>
          )}
        </p>
        <div className="flex gap-2 print:hidden">
          <button onClick={exportToPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Table className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {["Customer Name", "Contact Number", "Email", "Total Jobs", "Last Service Date", ""].map((h, i) => (
                <th key={i} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No customers found.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.customer_id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3.5 font-medium text-gray-800">{r.full_name}</td>
                <td className="px-4 py-3.5 text-blue-500">{r.contact_number}</td>
                <td className="px-4 py-3.5 text-blue-500">{r.email ?? "—"}</td>
                <td className="px-4 py-3.5 text-gray-700 font-medium">{r.totalJobs}</td>
                <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                  {r.lastServiceDate ? formatDate(r.lastServiceDate) : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap">
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 print:hidden">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show Results:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none">
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "...")[]>((acc, n, i, arr) => {
                if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("...")
                acc.push(n); return acc
              }, [])
              .map((item, i) => item === "..." ? (
                <span key={`e${i}`} className="px-2 text-gray-400 text-sm">...</span>
              ) : (
                <button key={item} onClick={() => setPage(item as number)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === item ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                  {item}
                </button>
              ))}
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
