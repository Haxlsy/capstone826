"use client"

import { fmtTime } from "@/lib/audit-helpers"
import { ApiLog, AuditCategory, AuditRole} from "@/types/audit"
import { CATEGORY_ICON, ROLE_BADGE, ROLE_LABEL, CATEGORY_COLOR } from "../Constants/config"

export default function renderRow(entry: ApiLog, showTarget: boolean) {
    const role     = entry.role     as AuditRole
    const category = entry.category as AuditCategory
    return (
      <tr key={entry.id} className="hover:bg-gray-50/60 transition-colors">
        <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">{fmtTime(entry.created_at)}</td>
        <td className="py-3 pr-4 font-medium text-gray-800 whitespace-nowrap">{entry.user_name}</td>
        <td className="py-3 pr-4">
          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-600"}`}>
            {ROLE_LABEL[role] ?? entry.role}
          </span>
        </td>
        <td className="py-3 pr-4">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg whitespace-nowrap ${CATEGORY_COLOR[category] ?? "text-gray-600 bg-gray-100"}`}>
            {CATEGORY_ICON[category] ?? null}
            {entry.action}
          </span>
        </td>
        {showTarget && (
          <td className="py-3 text-xs text-gray-500 font-mono">{entry.target || "—"}</td>
        )}
      </tr>
    )
  }