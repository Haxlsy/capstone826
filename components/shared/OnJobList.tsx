"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { workloadLabel } from "@/lib/operations/workload"

export interface OnJobEntry {
  job_id: string
  /** Job order code, e.g. JO-2026-0012 — shown instead of the customer. */
  code: string
  customer: string
  service: string
}

/**
 * The "On Job" line for a technician, identified by job order code (a person
 * can be on several jobs, and the code tells them apart; customer and service
 * are in the tooltip).
 *
 * - One job: "On Job — JO-…".
 * - Two or more: a collapsed "On N jobs" toggle that expands to the codes.
 *
 * `linkBase` makes each code a link to that job (Operations); without it the
 * codes are plain text (e.g. Admin, which can't open Operations' job pages).
 */
export function OnJobList({ jobs, linkBase }: { jobs: OnJobEntry[]; linkBase?: string }) {
  const [open, setOpen] = useState(false)
  if (jobs.length === 0) return null

  const code = (j: OnJobEntry) => {
    const title = `${j.customer} — ${j.service}`
    return linkBase ? (
      <Link
        href={`${linkBase}/${j.job_id}`}
        title={title}
        className="font-mono font-medium text-status-onjob hover:underline"
      >
        {j.code}
      </Link>
    ) : (
      <span title={title} className="font-mono font-medium text-status-onjob">{j.code}</span>
    )
  }

  if (jobs.length === 1) {
    return (
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
        <Wrench className="h-3 w-3 shrink-0 text-status-onjob" />
        <span className="shrink-0 font-medium text-status-onjob">On Job —</span>
        <span className="truncate">{code(jobs[0])}</span>
      </div>
    )
  }

  return (
    <div className="mt-0.5 text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-medium text-status-onjob hover:underline"
      >
        <Wrench className="h-3 w-3 shrink-0" />
        {workloadLabel(jobs.length)}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 border-l border-status-onjob/30 pl-3">
          {jobs.map((j) => (
            <li key={j.job_id} className="truncate">{code(j)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
