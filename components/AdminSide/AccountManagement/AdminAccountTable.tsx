"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, MoreHorizontal, Archive, ArchiveRestore, Pencil, ShieldCheck, KeyRound, Copy, Check } from "lucide-react"
import AddAccountModal from "./AddAccountModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Button } from "@/components/ui/Button"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Popover, MenuItem } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { StatusBadge } from "@/components/ui/Badge"
import { useToast } from "@/components/ui/Toast"
import { initials } from "@/lib/ui/avatar"
import { cn } from "@/lib/utils"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

interface AdminAccount {
  id: string
  full_name: string
  username: string
  role: "admin"
  is_archived: boolean
  created_at: string
}

export default function AdminAccountTable() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active")
  const [modalOpen, setModalOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AdminAccount | undefined>(undefined)
  const [archiveTarget, setArchiveTarget] = useState<AdminAccount | null>(null)

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/accounts?admin=true&status=${statusFilter}&pageSize=200`)
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
  }, [statusFilter])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // Another super admin creating/archiving/editing an admin account should
  // show up here without a manual reload.
  useRealtimeRefetch("user_account", fetchAccounts)

  async function handleArchiveToggle(account: AdminAccount) {
    setArchiveTarget(null)
    const newArchived = !account.is_archived
    const res = await fetch("/api/admin/archive-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.id, isArchived: newArchived }),
    })
    if (res.ok) toast.success(newArchived ? "Admin account archived." : "Admin account restored.")
    else toast.error("Failed to update account status.")
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
        toast.error(json.error ?? "Failed to reset password.")
      } else {
        setResetResult(json.password)
        setResetTarget(null)
      }
    } catch {
      toast.error("Network error. Please try again.")
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

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase()
    return a.full_name.toLowerCase().includes(q) || a.username.toLowerCase().includes(q)
  })

  const columns: Column<AdminAccount>[] = [
    {
      key: "admin",
      header: "Admin",
      cell: (a) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-concern/12 text-xs font-bold text-status-concern">
            {initials(a.full_name)}
          </span>
          <span className="font-medium text-heading">{a.full_name}</span>
        </div>
      ),
    },
    { key: "username", header: "Username", cell: (a) => <span className="font-mono text-xs text-body">{a.username}</span> },
    {
      key: "status",
      header: "Status",
      cell: (a) =>
        a.is_archived ? (
          <StatusBadge status="archived" />
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-status-inspection">
            <ShieldCheck className="h-3.5 w-3.5" /> Active
          </span>
        ),
    },
    {
      key: "added",
      header: "Added",
      cell: (a) => (
        <span className="text-xs text-muted">
          {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => (
        <Popover
          align="end"
          trigger={({ toggle }) => (
            <button
              type="button"
              aria-label="Account options"
              onClick={toggle}
              className="rounded-sm p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-body"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={Pencil}
                onClick={() => {
                  close()
                  setEditAccount(a)
                  setModalOpen(true)
                }}
              >
                Edit Account
              </MenuItem>
              <MenuItem
                icon={KeyRound}
                onClick={() => {
                  close()
                  setResetTarget({ id: a.id, name: a.full_name })
                }}
              >
                Reset Password
              </MenuItem>
              <MenuItem
                icon={a.is_archived ? ArchiveRestore : Archive}
                danger={!a.is_archived}
                onClick={() => {
                  close()
                  setArchiveTarget(a)
                }}
              >
                {a.is_archived ? "Unarchive" : "Archive"}
              </MenuItem>
            </>
          )}
        </Popover>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Admin Accounts"
        subtitle="Manage Admin user accounts. Visible to Super Admin only."
        actions={
          <Button
            onClick={() => {
              setEditAccount(undefined)
              setModalOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Add Admin Account
          </Button>
        }
      />

      <div className="flex flex-wrap items-start gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search admin accounts…"
          containerClassName="max-w-sm flex-1"
        />
        <Popover
          align="start"
          trigger={({ open, toggle }) => (
            <FilterTrigger
              open={open}
              onClick={toggle}
              active={statusFilter !== "active"}
              count={statusFilter !== "active" ? 1 : 0}
            />
          )}
          panelClassName="w-56 p-4"
        >
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-body">Status</p>
          <div className="space-y-0.5">
            {(["all", "active", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "w-full rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors",
                  statusFilter === s ? "bg-primary-soft font-medium text-primary" : "text-body hover:bg-surface-muted",
                )}
              >
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {statusFilter !== "active" && (
            <button
              onClick={() => setStatusFilter("active")}
              className="mt-3 text-left text-xs text-muted transition-colors hover:text-status-delayed"
            >
              Clear filter
            </button>
          )}
        </Popover>
      </div>

      <ConfirmModal
        open={resetTarget !== null}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`A new temporary password will be generated for ${resetTarget?.name ?? "this user"}. Share it with them directly.`}
        confirmLabel="Reset"
        loading={resetting}
        icon={KeyRound}
      />

      <ConfirmModal
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && handleArchiveToggle(archiveTarget)}
        title={archiveTarget?.is_archived ? "Unarchive Admin" : "Archive Admin"}
        message={`${archiveTarget?.is_archived ? "Unarchive" : "Archive"} ${archiveTarget?.full_name ?? "this admin"}?`}
        confirmLabel="Confirm"
        tone={archiveTarget?.is_archived ? "primary" : "danger"}
        icon={Archive}
      />

      <Modal open={resetResult !== null} onClose={() => { setResetResult(null); setCopied(false) }} size="sm" bare>
        <div className="flex flex-col items-center gap-2 py-1 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-inspection/12 text-status-inspection">
            <KeyRound className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-heading">Password Reset</h2>
          <p className="text-sm text-body">Copy this password and give it to the user. It won&apos;t be shown again.</p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-sm border border-border bg-surface-subtle px-4 py-3">
          <span className="flex-1 select-all font-mono text-sm tracking-wider text-heading">{resetResult}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy password"
            className="shrink-0 rounded-sm p-1.5 text-muted transition-colors hover:bg-border/60 hover:text-body"
          >
            {copied ? <Check className="h-4 w-4 text-status-inspection" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <Button fullWidth className="mt-4" onClick={() => { setResetResult(null); setCopied(false) }}>
          Done
        </Button>
      </Modal>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(a) => a.id}
        loading={loading}
        error={fetchError}
        emptyLabel="No admin accounts found."
      />

      <AddAccountModal
        open={modalOpen}
        mode="admin"
        onClose={() => {
          setModalOpen(false)
          setEditAccount(undefined)
        }}
        onSuccess={() => {
          fetchAccounts()
          setModalOpen(false)
          setEditAccount(undefined)
        }}
        editAccount={editAccount}
      />
    </div>
  )
}
