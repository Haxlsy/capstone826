"use client"

import { fmtTime } from "@/hooks/audit-helpers"
import { ApiLog, AuditCategory, AuditRole} from "@/types/audit"
import { CATEGORY_ICON, ROLE_BADGE, ROLE_LABEL, CATEGORY_COLOR } from "../Constants/config"
import { ExpiresBadge } from "@/components/shared/RetentionDate"
import type { RetentionPolicy } from "@/lib/retention/plan"

/** `retention`: when given, rows near automatic deletion get an "Expires in N days" badge. */
export default function renderRow(entry: ApiLog, showTarget: boolean, retention: RetentionPolicy | null = null) {
    const role     = entry.role     as AuditRole
    const category = entry.category as AuditCategory
    return (
      <tr key={entry.id} className="hover:bg-surface-muted/60 transition-colors">
        <td className="py-3 pr-4 text-xs text-muted whitespace-nowrap">
          {fmtTime(entry.created_at)}
          <ExpiresBadge anchor={entry.created_at} policy={retention} className="mt-1 flex w-fit" />
        </td>
        <td className="py-3 pr-4 font-medium text-heading whitespace-nowrap">{entry.user_name}</td>
        <td className="py-3 pr-4">
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ROLE_BADGE[role] ?? "bg-surface-muted text-body"}`}>
            {ROLE_LABEL[role] ?? entry.role}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-sm whitespace-nowrap ${CATEGORY_COLOR[category] ?? "text-body bg-surface-muted"}`}>
            {CATEGORY_ICON[category] ?? null}
            {entry.action}
          </span>
        </td>
        {showTarget && (
          <td className="py-3 text-xs text-body">{entry.target || "—"}</td>
        )}
      </tr>
    )
  }