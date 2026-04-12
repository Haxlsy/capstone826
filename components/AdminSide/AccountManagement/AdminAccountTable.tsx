"use client"

import { useEffect, useState } from "react"
import { Plus, Search, MoreHorizontal, Archive, Pencil, ShieldCheck } from "lucide-react"
import AddAccountModal from "./AddAccountModal"

interface AdminAccount {
  id: string
  full_name: string
  username: string
  role: "admin"
  is_archived: boolean
  created_at: string
}

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AdminAccountTable() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AdminAccount | undefined>(undefined)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch("/api/admin/accounts?admin=true")
      const json = await res.json()
      if (!res.ok) {
        setFetchError(json.error ?? "Failed to load accounts.")
      } else {
        setAccounts(json.accounts ?? [])
      }
    } catch {
      setFetchError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleArchiveToggle(account: AdminAccount) {
    setArchiveConfirmId(null)
    const newArchived = !account.is_archived
    await fetch("/api/admin/archive-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.id, isArchived: newArchived }),
    })
    fetchAccounts()
  }

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.username.toLowerCase().includes(q)
    )
  })

  function handleEdit(account: AdminAccount) {
    setEditAccount(account)
    setModalOpen(true)
    setOpenMenuId(null)
  }

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Admin Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage Admin user accounts. Visible to Super Admin only.</p>
        </div>
        <button
          onClick={() => { setEditAccount(undefined); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Admin Account
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search admin accounts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-gray-400">Loading...</td>
              </tr>
            ) : fetchError ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-red-400">{fetchError}</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-sm text-gray-400">No admin accounts found.</td>
              </tr>
            ) : (
              filtered.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
                        {getInitials(account.full_name)}
                      </div>
                      <p className="font-medium text-gray-800">{account.full_name}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 font-mono text-xs">{account.username}</td>
                  <td className="px-5 py-4">
                    {account.is_archived ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Archived</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                        <ShieldCheck className="w-3.5 h-3.5" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">
                    {new Date(account.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === account.id ? null : account.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenuId === account.id && (
                        <div className="absolute right-0 top-8 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                          <button
                            onClick={() => handleEdit(account)}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit Account
                          </button>
                          <button
                            onClick={() => { setArchiveConfirmId(account.id); setOpenMenuId(null) }}
                            className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm transition-colors ${
                              account.is_archived
                                ? "text-green-600 hover:bg-green-50"
                                : "text-red-500 hover:bg-red-50"
                            }`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                            {account.is_archived ? "Unarchive" : "Archive"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Archive confirmation inline */}
                    {archiveConfirmId === account.id && (
                      <div className="absolute right-16 mt-1 w-60 bg-white border border-red-100 rounded-xl shadow-lg z-20 p-4">
                        <p className="text-sm text-gray-700 mb-3">
                          {account.is_archived ? "Unarchive" : "Archive"} <strong>{account.full_name}</strong>?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleArchiveToggle(account)}
                            className="flex-1 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setArchiveConfirmId(null)}
                            className="flex-1 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddAccountModal
        open={modalOpen}
        mode="admin"
        onClose={() => { setModalOpen(false); setEditAccount(undefined) }}
        onSuccess={() => { fetchAccounts(); setModalOpen(false); setEditAccount(undefined) }}
        editAccount={editAccount}
      />
    </div>
  )
}
