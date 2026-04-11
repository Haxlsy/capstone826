"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import AddAccountModal from "./AddAccountModal"

type UserRole = "admin" | "operations" | "sales" | "head_detailer" | "head_installer" | "installer" | "detailer"

interface Account {
  user_id: string
  full_name: string
  user_name: string
  role: UserRole
  contact_no: string
  is_archived: boolean
  created_at: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin:          "Admin",
  operations:     "Operations",
  sales:          "Sales",
  head_detailer:  "Head Detailer",
  head_installer: "Head Installer",
  installer:      "Installer",
  detailer:       "Detailer",
}

const ROLE_BADGE: Record<UserRole, string> = {
  admin:          "bg-purple-50 text-purple-600",
  operations:     "bg-blue-50 text-blue-600",
  sales:          "bg-green-50 text-green-600",
  head_detailer:  "bg-orange-50 text-orange-500",
  head_installer: "bg-amber-50 text-amber-600",
  installer:      "border border-gray-200 text-gray-600",
  detailer:       "bg-gray-50 text-gray-500",
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AccountTable() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all")
  const [filterOpen, setFilterOpen] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const filterRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) {
        setActionMenu(null)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, statusFilter, pageSize])

  useEffect(() => {
    fetchAccounts()
  }, [search, roleFilter, statusFilter, page, pageSize])

  async function fetchAccounts() {
    setLoading(true)
    setFetchError(null)

    const params = new URLSearchParams({
      search,
      role: roleFilter,
      status: statusFilter,
      page: String(page),
      pageSize: String(pageSize),
    })

    console.log("[AccountTable] fetching /api/admin/accounts?", params.toString())

    try {
      const res = await fetch(`/api/admin/accounts?${params}`)
      const json = await res.json()

      if (!res.ok) {
        console.error("[AccountTable] fetch error:", json.error)
        setFetchError(json.error ?? "Failed to load accounts.")
      } else {
        console.log("[AccountTable] received", json.accounts?.length, "rows, total:", json.total)
        setAccounts(json.accounts ?? [])
        setTotalCount(json.total ?? 0)
      }
    } catch (err) {
      console.error("[AccountTable] network error:", err)
      setFetchError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleArchiveToggle(account: Account) {
    setActionMenu(null)
    const newArchived = !account.is_archived
    console.log("[AccountTable] toggling archive for", account.user_id, "→", newArchived)
    const res = await fetch("/api/admin/archive-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.user_id, isArchived: newArchived }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error("[AccountTable] archive toggle failed:", json.error)
    }
    fetchAccounts()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === accounts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(accounts.map((a) => a.user_id)))
    }
  }

  const allSelected = accounts.length > 0 && selected.size === accounts.length

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <h1 className="text-xl font-bold text-gray-800">Account Management</h1>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-72 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white"
          />
        </div>

        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
              roleFilter !== "all" || statusFilter !== "all"
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>

          {filterOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-gray-100 rounded-xl shadow-lg z-10 p-3 space-y-3">
              {/* Role filter */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Role</p>
                <div className="space-y-0.5">
                  {(["all", "admin", "operations", "sales", "head_detailer", "head_installer", "installer", "detailer"] as const).map(
                    (r) => (
                      <button
                        key={r}
                        onClick={() => setRoleFilter(r)}
                        className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                          roleFilter === r
                            ? "bg-blue-50 text-blue-600 font-medium"
                            : "text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {r === "all" ? "All Roles" : ROLE_LABELS[r]}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Status filter */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Status</p>
                <div className="space-y-0.5">
                  {(["all", "active", "archived"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`w-full text-left text-sm px-2.5 py-1.5 rounded-lg transition-colors ${
                        statusFilter === s
                          ? "bg-blue-50 text-blue-600 font-medium"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => { setRoleFilter("all"); setStatusFilter("all") }}
                className="w-full text-xs text-gray-400 hover:text-gray-600 text-center pt-1"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Add Account */}
        <button
          onClick={() => setAddModalOpen(true)}
          className="ml-auto flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          + Add Account
        </button>
      </div>

      <AddAccountModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => fetchAccounts()}
      />

      <AddAccountModal
        open={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        onSuccess={() => fetchAccounts()}
        editAccount={editingAccount ?? undefined}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Username
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Contact Number
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-red-400">
                  Failed to load accounts: {fetchError}
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                  No accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr
                  key={account.user_id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selected.has(account.user_id)}
                      onChange={() => toggleSelect(account.user_id)}
                      className="rounded border-gray-300"
                    />
                  </td>

                  {/* Name + avatar */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold flex items-center justify-center shrink-0">
                        {getInitials(account.full_name)}
                      </div>
                      <span className="font-medium text-gray-800">{account.full_name}</span>
                    </div>
                  </td>

                  {/* Username */}
                  <td className="px-4 py-3.5 text-gray-500">{account.user_name}</td>

                  {/* Role */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[account.role]}`}
                    >
                      {ROLE_LABELS[account.role]}
                    </span>
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-3.5 text-gray-600">{account.contact_no}</td>

                  {/* Status */}
                  <td className="px-4 py-3.5">
                    {account.is_archived ? (
                      <span className="text-gray-400 text-sm">Archived</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                        Active
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 relative">
                    <div ref={actionMenu === account.user_id ? actionRef : null}>
                      <button
                        onClick={() =>
                          setActionMenu((prev) =>
                            prev === account.user_id ? null : account.user_id
                          )
                        }
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {actionMenu === account.user_id && (
                        <div className="absolute right-4 top-full mt-1 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                          <button
                            onClick={() => { setActionMenu(null); setEditingAccount(account) }}
                            className="w-full text-left text-sm px-3.5 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchiveToggle(account)}
                            className={`w-full text-left text-sm px-3.5 py-2 transition-colors ${
                              account.is_archived
                                ? "text-green-600 hover:bg-green-50"
                                : "text-red-500 hover:bg-red-50"
                            }`}
                          >
                            {account.is_archived ? "Unarchive" : "Archive"}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show Results:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
              .reduce<(number | "...")[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("...")
                acc.push(n)
                return acc
              }, [])
              .map((item, idx) =>
                item === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item as number)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === item
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
