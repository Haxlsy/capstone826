"use client"

import Link from "next/link"
import { FileText, Users, Activity, Download } from "lucide-react"
import { formatDate } from "./ExportUtils"

const REPORT_CARDS = [
  {
    title: "Job Order Reports",
    description:
      "Summary of all job orders by period, status, service type, or technician.",
    icon: FileText,
    href: "/dashboard/admin/reports/job-orders",
  },
  {
    title: "Customer Reports",
    description:
      "Summary of customer records and associated service histories.",
    icon: Users,
    href: "/dashboard/admin/reports/customers",
  },
  {
    title: "Technician Performance Log",
    description:
      "Detailed work history per technician for accountability and monitoring.",
    icon: Activity,
    href: "/dashboard/admin/reports/technician-performance",
  },
]

// Mock recent reports — replace with a real reports log table when available
const RECENT_REPORTS = [
  { name: "March 2026 Job Orders", type: "Job Order", date: "2026-03-31T10:00:00Z" },
  { name: "Q1 Customer Summary", type: "Customer", date: "2026-03-31T09:00:00Z" },
  { name: "Technician Log — March", type: "Performance", date: "2026-03-30T08:00:00Z" },
  { name: "February 2026 Job Orders", type: "Job Order", date: "2026-02-28T10:00:00Z" },
]

const TYPE_BADGE: Record<string, string> = {
  "Job Order": "bg-blue-50 text-blue-600",
  Customer: "bg-green-50 text-green-600",
  Performance: "bg-orange-50 text-orange-500",
}

export default function ReportsHub() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Reports</h1>

      {/* Report Type Cards */}
      <div className="grid grid-cols-3 gap-5">
        {REPORT_CARDS.map(({ title, description, icon: Icon, href }) => (
          <div
            key={title}
            className="bg-white rounded-xl border border-gray-100 p-6 flex flex-col gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
              <Icon className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-800">{title}</h2>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">{description}</p>
            </div>
            <Link
              href={href}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg text-center hover:bg-gray-700 transition-colors"
            >
              Generate
            </Link>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Recent Reports</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Report Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-40">
                  Date Generated
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {RECENT_REPORTS.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-800 font-medium">{r.name}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        TYPE_BADGE[r.type] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(r.date)}</td>
                  <td className="px-5 py-3.5">
                    <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
