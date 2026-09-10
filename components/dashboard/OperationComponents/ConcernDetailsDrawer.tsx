"use client"

import { useState } from "react"
import { CheckCircle, Paperclip } from "lucide-react"
import { Drawer } from "@/components/ui/Drawer"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Textarea } from "@/components/ui/Field"
import { useToast } from "@/components/ui/Toast"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { enqueue } from "@/lib/offline/outbox"
import type { ConcernRecord } from "@/lib/operations/concern-record"

interface ConcernDetailsDrawerProps {
  record: ConcernRecord | null
  onClose: () => void
  onResolve: (id: string, note: string) => void
}

export default function ConcernDetailsDrawer({ record, onClose, onResolve }: ConcernDetailsDrawerProps) {
  const toast = useToast()
  const isOnline = useOnlineStatus()
  const [responseNote, setResponseNote] = useState("")
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const isResolved = record?.status === "Resolved"

  async function handleResolve() {
    if (!record) return
    setResolving(true)
    setResolveError(null)
    try {
      // Offline — queue the resolution instead of writing it now; it lands
      // for real once this syncs. See docs/plan/operations-offline-mode-plan.md.
      if (!isOnline) {
        await enqueue("resolve_concern", {
          concernId: record.id,
          status: "Resolved",
          response_note: responseNote,
        })
        onResolve(record.id, responseNote)
        setResponseNote("")
        toast.info("You're offline — resolution queued. It'll sync when you're back online.")
        return
      }

      const res = await fetch(`/api/operations/job-concerns/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Resolved", response_note: responseNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to resolve concern")
      onResolve(record.id, responseNote)
      setResponseNote("")
      toast.success("Concern marked as resolved.")
    } catch (err: unknown) {
      setResolveError(err instanceof Error ? err.message : String(err))
    } finally {
      setResolving(false)
    }
  }

  return (
    <Drawer
      open={record !== null}
      onClose={onClose}
      title="Concern Details"
      width="md"
      footer={
        record ? (
          isResolved ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-sm bg-status-inspection/12 py-2.5 text-sm font-semibold text-status-inspection">
              <CheckCircle className="h-4 w-4" />
              Resolved
            </div>
          ) : (
            <Button fullWidth onClick={handleResolve} disabled={resolving}>
              {resolving ? "Resolving…" : "Mark as Resolved"}
            </Button>
          )
        ) : null
      }
    >
      {record && (
        <div className="space-y-5">
          <Field label="Submitted By">
            <p className="text-sm font-semibold text-heading">{record.submitterName}</p>
            <p className="text-xs capitalize text-muted">{record.submitterRole.replace("_", " ")}</p>
          </Field>
          <Field label="Submitted">
            <p className="text-sm text-body">{record.submitted_at}</p>
          </Field>
          {record.stage_name && (
            <Field label="Stage">
              <Badge className="bg-primary/12 text-primary">{record.stage_name}</Badge>
            </Field>
          )}
          <Field label="Title">
            <p className="text-sm font-semibold text-heading">{record.title}</p>
          </Field>
          <Field label="Description">
            <p className="text-sm leading-relaxed text-body">{record.description}</p>
          </Field>

          {record.media.length > 0 && (
            <Field label={`Attachments (${record.media.length})`} icon={<Paperclip className="h-3 w-3" />}>
              <div className="flex flex-wrap gap-2">
                {record.media.map((m) =>
                  m.media_type === "photo" ? (
                    <a key={m.id} href={m.file_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.file_url}
                        alt="concern attachment"
                        className="h-16 w-16 rounded-sm border border-border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                  ) : (
                    <a
                      key={m.id}
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      ▶ Video
                    </a>
                  ),
                )}
              </div>
            </Field>
          )}

          <Field label="Response Note">
            {isResolved ? (
              <div className="min-h-[3rem] rounded-sm border border-border bg-surface-subtle px-3 py-2.5 text-sm text-body">
                {record.response_note ?? "—"}
              </div>
            ) : (
              <Textarea
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                placeholder="Add notes for this concern…"
                rows={4}
              />
            )}
          </Field>

          {resolveError && <p className="text-xs text-status-delayed">{resolveError}</p>}
        </div>
      )}
    </Drawer>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-xs text-muted">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}
