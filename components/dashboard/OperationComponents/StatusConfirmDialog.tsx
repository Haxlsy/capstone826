"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { StatusBadge } from "@/components/ui/Badge"
import { Textarea, FieldLabel } from "@/components/ui/Field"
import { cn } from "@/lib/utils"
import { statusStyle } from "@/lib/ui/status"
import type { StatusOption } from "./StatusPickerModal"

const MAX_REASON = 300

interface Props {
  customerName: string
  target: StatusOption
  error: string | null
  updating: boolean
  onConfirm: (reason: string) => void
  onBack: () => void
  count?: number
}

export default function StatusConfirmDialog({
  customerName,
  target,
  error,
  updating,
  onConfirm,
  onBack,
  count,
}: Props) {
  const [reason, setReason] = useState("")
  const isBulk = count !== undefined && count > 1
  const subject = isBulk ? `${count} selected jobs` : customerName
  const s = statusStyle(target.label)
  const Icon = target.icon

  return (
    <Modal open onClose={updating ? undefined : onBack} size="sm" bare>
      <div className="flex flex-col items-center gap-2 py-1 text-center">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full", s.iconChip)}>
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-base font-semibold text-heading">Confirm Status Change</h2>
        <p className="text-sm text-body">
          Update <span className="font-semibold text-heading">{subject}</span> to
        </p>
        <StatusBadge status={target.label} />
      </div>

      <div className="mt-4">
        <FieldLabel>
          Reason <span className="font-normal text-muted">(optional)</span>
        </FieldLabel>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
          rows={3}
          placeholder="Describe the reason for this status change…"
        />
        <p className="mt-0.5 text-right text-[10px] text-muted">
          {reason.length}/{MAX_REASON}
        </p>
      </div>

      {error && (
        <p className="mt-2 rounded-sm bg-status-delayed/10 px-3 py-2 text-xs text-status-delayed">{error}</p>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant="subtle" fullWidth onClick={onBack} disabled={updating}>
          Back
        </Button>
        <Button
          variant={target.db === "Delayed" ? "danger" : "primary"}
          fullWidth
          onClick={() => onConfirm(reason.trim())}
          disabled={updating}
        >
          {updating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Updating…
            </>
          ) : (
            "Confirm"
          )}
        </Button>
      </div>
    </Modal>
  )
}
