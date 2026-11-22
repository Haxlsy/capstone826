import CustomerRecords from "@/components/dashboard/SalesDashboard/CustomerRecords"

export default async function CustomerRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ expiring?: string }>
}) {
  // ?expiring=1 comes from the weekly data-retention notice.
  const { expiring } = await searchParams
  return (
    <div className="p-4 md:p-6">
      <CustomerRecords initialExpiring={expiring === "1"} />
    </div>
  )
}
