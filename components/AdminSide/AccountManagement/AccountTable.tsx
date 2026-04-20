"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Filter, MoreHorizontal, ChevronLeft, ChevronRight, KeyRound, Copy, Check, Pencil, ArchiveRestore } from "lucide-react"
import AddAccountModal from "./AddAccountModal"

type UserRole = "operations" | "sales" | "head_detailer" | "head_installer"

interface Account {
  id: string
  full_name: string
  username: string
  role: UserRole
  is_archived: boolean
  created_at: string
}

const ROLE_LABELS: Record<UserRole, string> = {
  operations:     "Operations",
  sales:          "Sales",
  head_detailer:  "Head Detailer",
  head_installer: "Head Installer",
}

const ROLE_BADGE: Record<UserRole, string> = {
  operations:     "bg-blue-50 text-blue-600",
  sales:          "bg-green-50 text-green-600",
  head_detailer:  "bg-orange-50 text-orange-500",
  head_installer: "bg-amber-50 text-amber-600",
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

  // Reset password
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    const res = await fetch("/api/admin/archive-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.id, isArchived: newArchived }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      console.error("[AccountTable] archive toggle failed:", json.error)
    }
    fetchAccounts()
  }

  async function handleResetPassword() {
    if (!resetTarget) return
    setResetting(true)
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetTarget.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? "Failed to reset password.")
      } else {
        setResetResult(json.password)
        setResetTarget(null)
      }
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setResetting(false)
    }
  }

  function handleCopy() {
    if (!resetResult) return
    navigator.clipboard.writeText(resetResult)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
      setSelected(new Set(accounts.map((a) => a.id)))
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
                  {(["all", "operations", "sales", "head_detailer", "head_installer"] as const).map(
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

      {/* ── Confirmation modal ─────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center">Reset Password</h3>
            <p className="text-sm text-gray-500 text-center mt-2">
              A new temporary password will be generated for{" "}
              <span className="font-medium text-gray-700">{resetTarget.name}</span>.
              Share it with them directly.
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
                className="flex-1 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetting}
                className="flex-1 py-2 text-sm font-medium bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {resetting ? "Resetting…" : "Reset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Result modal ────────────────────────────────────────── */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-green-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 text-center">Password Reset</h3>
            <p className="text-sm text-gray-500 text-center mt-1">
              Copy this password and give it to the user. It won&apos;t be shown again.
            </p>
            <div className="flex items-center gap-2 mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <span className="flex-1 font-mono text-sm text-gray-800 tracking-wider select-all">
                {resetResult}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors"
                aria-label="Copy password"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setResetResult(null); setCopied(false) }}
              className="mt-4 w-full py-2 text-sm font-medium bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
                  aria-label="Select all accounts"
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
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-red-400">
                  Failed to load accounts: {fetchError}
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-sm text-gray-400">
                  No accounts found.
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr
                  key={account.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <input
                      aria-label="Select account"
                      type="checkbox"
                      checked={selected.has(account.id)}
                      onChange={() => toggleSelect(account.id)}
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
                  <td className="px-4 py-3.5 text-gray-500">{account.username}</td>

                  {/* Role */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[account.role] ?? "bg-gray-50 text-gray-500"}`}
                    >
                      {ROLE_LABELS[account.role] ?? account.role}
                    </span>
                  </td>

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
                    <div ref={actionMenu === account.id ? actionRef : null}>
                      <button
                        aria-label="Open menu for account options"
                        onClick={() =>
                          setActionMenu((prev) =>
                            prev === account.id ? null : account.id
                          )
                        }
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {actionMenu === account.id && (
                        <div className="absolute right-4 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                          <button
                            onClick={() => { setActionMenu(null); setEditingAccount(account) }}
                            className="flex items-center gap-2 w-full text-left text-sm px-3.5 py-2 text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => { setActionMenu(null); setResetTarget({ id: account.id, name: account.full_name }) }}
                            className="flex items-center gap-2 w-full text-left text-sm px-3.5 py-2 text-amber-600 hover:bg-amber-50 transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleArchiveToggle(account)}
                            className={`flex items-center gap-2 w-full text-left text-sm px-3.5 py-2 transition-colors ${
                              account.is_archived
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-red-500 hover:bg-red-50"
                            }`}
                          >
                            {account.is_archived && <ArchiveRestore className="w-3.5 h-3.5" />}
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
              aria-label="Select number of accounts to show per page"
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
              aria-label="Go to previous page"
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
              aria-label="Go to next page"
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
