import DynamicSidebar from "@/components/dashboard/DynamicSidebar"
import DynamicTopBar from "@/components/dashboard/DynamicTopBar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <DynamicSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <DynamicTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
