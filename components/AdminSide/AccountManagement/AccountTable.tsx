"use client"

import { useEffect, useState } from "react"
import { MoreHorizontal, KeyRound, Copy, Check, Pencil, Archive, ArchiveRestore } from "lucide-react"
import AddAccountModal from "./AddAccountModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchBar } from "@/components/ui/SearchBar"
import { Button } from "@/components/ui/Button"
import { DataTable, type Column } from "@/components/ui/DataTable"
import { Pagination } from "@/components/ui/Pagination"
import { Popover, MenuItem } from "@/components/ui/Popover"
import { FilterTrigger } from "@/components/ui/FilterTrigger"
import { Modal, ConfirmModal } from "@/components/ui/Modal"
import { Badge, StatusBadge } from "@/components/ui/Badge"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import { roleStyle, roleLabel } from "@/lib/ui/roles"
import { initials } from "@/lib/ui/avatar"
import { useRealtimeRefetch } from "@/hooks/useRealtimeRefetch"

type UserRole = "operations" | "sales" | "head_detailer" | "head_installer"

interface Account {
  id: string
  full_name: string
  username: string
  role: UserRole
  is_archived: boolean
  created_at: string
}

const PAGE_SIZE_OPTIONS = [10, 15, 20, 30]

export default function AccountTable() {
  const toast = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all")

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null)
  const [resetting, setResetting] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [refetchKey, setRefetchKey] = useState(0)

  const forceRefetch = () => setRefetchKey((k) => k + 1)

  // Another admin creating/archiving/editing an account should show up here
  // without a manual reload.
  useRealtimeRefetch("user_account", forceRefetch)

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, statusFilter, pageSize])

  useEffect(() => {
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
      try {
        const res = await fetch(`/api/admin/accounts?${params}`)
        const json = await res.json()
        if (!res.ok) {
          setFetchError(json.error ?? "Failed to load accounts.")
        } else {
          setAccounts(json.accounts ?? [])
          setTotalCount(json.total ?? 0)
        }
      } catch {
        setFetchError("Network error. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    fetchAccounts()
  }, [search, roleFilter, statusFilter, page, pageSize, refetchKey])

  async function handleArchiveToggle(account: Account) {
    const newArchived = !account.is_archived
    const res = await fetch("/api/admin/archive-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: account.id, isArchived: newArchived }),
    })
    if (!res.ok) {
      toast.error("Failed to update account status.")
    } else {
      toast.success(newArchived ? "Account archived." : "Account restored.")
    }
    forceRefetch()
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasFilter = roleFilter !== "all" || statusFilter !== "all"

  const columns: Column<Account>[] = [
    {
      key: "name",
      header: "Name",
      cell: (a) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-body">
            {initials(a.full_name)}
          </span>
          <span className="font-medium text-heading">{a.full_name}</span>
        </div>
      ),
    },
    { key: "username", header: "Username", cell: (a) => <span className="text-body">{a.username}</span> },
    {
      key: "role",
      header: "Role",
      cell: (a) => <Badge className={roleStyle(a.role).badge}>{roleLabel(a.role)}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge status={a.is_archived ? "archived" : "active"} />,
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
              className="rounded-sm p-1 text-muted transition-colors hover:bg-surface-muted hover:text-body"
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
                  setEditingAccount(a)
                }}
              >
                Edit
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
                  handleArchiveToggle(a)
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
    <div className="space-y-5 p-6">
      <PageHeader
        title="Account Management"
        actions={<Button onClick={() => setAddModalOpen(true)}>+ Add Account</Button>}
      />

      <div className="flex flex-wrap items-start gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search accounts…"
          containerClassName="max-w-xs flex-1"
        />
        <Popover
          align="start"
          trigger={({ open, toggle }) => (
            <FilterTrigger
              open={open}
              onClick={toggle}
              active={hasFilter}
              count={(roleFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
            />
          )}
          panelClassName="w-[min(90vw,26rem)] p-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-body">Role</p>
              <div className="space-y-0.5">
                {(["all", "operations", "sales", "head_detailer", "head_installer"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={cn(
                      "w-full rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors",
                      roleFilter === r ? "bg-primary-soft font-medium text-primary" : "text-body hover:bg-surface-muted",
                    )}
                  >
                    {r === "all" ? "All Roles" : roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>
            <div>
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
            </div>
            {hasFilter && (
              <button
                onClick={() => {
                  setRoleFilter("all")
                  setStatusFilter("all")
                }}
                className="text-left text-xs text-muted transition-colors hover:text-status-delayed sm:col-span-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </Popover>
      </div>

      <AddAccountModal open={addModalOpen} onClose={() => setAddModalOpen(false)} onSuccess={forceRefetch} />
      <AddAccountModal
        open={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        onSuccess={forceRefetch}
        editAccount={editingAccount ?? undefined}
      />

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
        rows={accounts}
        rowKey={(a) => a.id}
        loading={loading}
        error={fetchError}
        emptyLabel="No accounts found."
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        }
      />
    </div>
  )
}
