import SecurityAuditCenter from "@/components/AdminSide/Security&AuditCenter/Security&AuditCenterPage"

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ expiring?: string }>
}) {
  // ?expiring=1 comes from the weekly data-retention notice.
  const { expiring } = await searchParams
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <SecurityAuditCenter initialExpiring={expiring === "1"} />
    </div>
  )
}
