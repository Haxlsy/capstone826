"use client"

import { User, Wrench, Calendar, Users } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { categorySwatch } from "@/lib/ui/category-colors"

export interface JobOrderSummary {
  customerName: string
  contactNumber: string
  email: string | null
  plateNumber: string
  vehicleUnit: string

  serviceName: string
  isOverridden: boolean
  stages: Array<{ name: string; category_name: string | null; category_color: string | null }>

  scheduledAt: string
  expectedEnd: string
  duration: string

  headDetailer: string
  headInstaller: string
  detailers: string[]
  installers: string[]
  /** Which teams this job needs — the other team's rows are hidden. Both when omitted. */
  teamNeeds?: { detailer: boolean; installer: boolean }
}

interface Props {
  summary: JobOrderSummary
  submitting: boolean
  onConfirm: () => void
  onBack: () => void
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border-subtle py-1.5 last:border-0">
      <span className="shrink-0 text-sm text-body">{label}</span>
      <span className="text-right text-sm font-semibold text-heading">{value || "—"}</span>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-sm bg-surface-subtle p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted" />
        <p className="text-xs font-semibold uppercase tracking-wide text-body">{title}</p>
      </div>
      {children}
    </div>
  )
}

export default function JobOrderConfirmDialog({ summary, submitting, onConfirm, onBack }: Props) {
  return (
    <Modal
      open
      onClose={submitting ? undefined : onBack}
      title={<span className="text-xl font-bold text-heading">Confirm Job Order</span>}
      description={<span className="text-base font-medium text-heading">Review details before creating.</span>}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onBack} disabled={submitting}>
            Back to Edit
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Creating…" : "Confirm & Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Section icon={User} title="Customer & Vehicle">
          <Row label="Name" value={summary.customerName} />
          <Row label="Contact" value={summary.contactNumber} />
          {summary.email && <Row label="Email" value={summary.email} />}
          <Row label="Plate" value={summary.plateNumber} />
          <Row label="Vehicle" value={summary.vehicleUnit} />
        </Section>

        <Section icon={Wrench} title="Service">
          <Row
            label="Service"
            value={summary.serviceName + (summary.isOverridden ? " (overridden)" : "")}
          />
          {summary.stages.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-body">
                Workflow Stages
              </p>
              {summary.stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-xs text-body">{i + 1}.</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-pill px-1.5 py-0.5 text-[9px] font-semibold",
                      categorySwatch(s.category_color).badge,
                    )}
                  >
                    {s.category_name ?? "—"}
                  </span>
                  <span className="text-sm text-body">{s.name}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon={Calendar} title="Schedule">
          <Row label="Scheduled" value={summary.scheduledAt} />
          <Row label="Expected Completion" value={summary.expectedEnd} />
          <Row label="Est. Duration" value={summary.duration} />
        </Section>

        <Section icon={Users} title="Team">
          {(summary.teamNeeds?.detailer ?? true) && (
            <>
              <Row label="Head Detailer" value={summary.headDetailer} />
              <Row label="Detailers" value={summary.detailers.join(", ")} />
            </>
          )}
          {(summary.teamNeeds?.installer ?? true) && (
            <>
              <Row label="Head Installer" value={summary.headInstaller} />
              <Row label="Installers" value={summary.installers.join(", ")} />
            </>
          )}
        </Section>
      </div>
    </Modal>
  )
}
