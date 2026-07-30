import SecurityAuditCenter from "@/components/AdminSide/Security&AuditCenter/Security&AuditCenterPage"
import { getAuditLogs } from "@/lib/admin/audit-data"

export default async function SecurityPage() {
  const initialLogs = await getAuditLogs()

  return (
    <div className="h-full overflow-y-auto p-6">
      <SecurityAuditCenter initialLogs={initialLogs} />
    </div>
  )
}
