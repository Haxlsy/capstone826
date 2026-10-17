import InquiryManagement from "@/components/dashboard/SalesDashboard/InquiryManagement"

export default function SalesDashboardPage() {
  return (
    // Pinned to the viewport only on desktop, where the inquiry list and detail
    // scroll inside their own panels; below 1024 the page scrolls instead.
    <div className="flex flex-col p-4 md:p-6 lg:h-full">
      <InquiryManagement />
    </div>
  )
}
