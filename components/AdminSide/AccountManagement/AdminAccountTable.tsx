"use client"

import { useState } from "react"
import { Plus, Search, MoreHorizontal, Archive, Pencil, ShieldCheck } from "lucide-react"
import AddAccountModal from "./AddAccountModal"

interface AdminAccount {
  user_id: string
  full_name: string
  user_name: string
  role: "admin"
  contact_no: string
  is_archived: boolean
  created_at: string
}

const MOCK_ADMINS: AdminAccount[] = [
  {
    user_id: "adm-001",
    full_name: "Ashley Dulay",
    user_name: "ashley.admin",
    role: "admin",
    contact_no: "09171234567",
    is_archived: false,
    created_at: "Jan 1, 2026",
  },
  {
    user_id: "adm-002",
    full_name: "Renz Bautista",
    user_name: "renz.admin",
    role: "admin",
    contact_no: "09281234567",
    is_archived: false,
    created_at: "Feb 15, 2026",
  },
]

function getInitials(name: string) {
  const parts = name.trim().split(" ")
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function AdminAccountTable() {
  const [accounts, setAccounts] = useState<AdminAccount[]>(MOCK_ADMINS)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AdminAccount | undefined>(undefined)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null)

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return (
      a.full_name.toLowerCase().includes(q) ||
      a.user_name.toLowerCase().includes(q) ||
      a.contact_no.includes(q)
    )
  })

  function handleEdit(account: AdminAccount) {
    setEditAccount(account)
    setModalOpen(true)
    setOpenMenuId(null)
  }

  function handleArchiveConfirm(id: string) {
    setAccounts((prev) =>
      prev.map((a) => (a.user_id === id ? { ...a, is_archived: true } : a))
    )
    setArchiveConfirmId(null)
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
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-sm text-gray-400">No admin accounts found.</td>
              </tr>
            )}
            {filtered.map((account) => (
              <tr key={account.user_id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
                      {getInitials(account.full_name)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{account.full_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-600 font-mono text-xs">{account.user_name}</td>
                <td className="px-5 py-4 text-gray-600">{account.contact_no}</td>
                <td className="px-5 py-4">
                  {account.is_archived ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Archived</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <ShieldCheck className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-gray-400 text-xs">{account.created_at}</td>
                <td className="px-5 py-4">
                  <div className="relative">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === account.user_id ? null : account.user_id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenuId === account.user_id && (
                      <div className="absolute right-0 top-8 w-44 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                        <button
                          onClick={() => handleEdit(account)}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit Account
                        </button>
                        {!account.is_archived && (
                          <button
                            onClick={() => { setArchiveConfirmId(account.user_id); setOpenMenuId(null) }}
                            className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" /> Archive Account
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Archive confirmation inline */}
                  {archiveConfirmId === account.user_id && (
                    <div className="absolute right-16 mt-1 w-60 bg-white border border-red-100 rounded-xl shadow-lg z-20 p-4">
                      <p className="text-sm text-gray-700 mb-3">Archive <strong>{account.full_name}</strong>? This will deactivate their account.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleArchiveConfirm(account.user_id)}
                          className="flex-1 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          Archive
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
            ))}
          </tbody>
        </table>
      </div>

      <AddAccountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(undefined) }}
        onSuccess={() => { setModalOpen(false); setEditAccount(undefined) }}
        editAccount={editAccount as any}
      />
    </div>
  )
}
