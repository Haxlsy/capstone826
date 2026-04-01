import Sidebar from "@/components/dashboard/SalesDashboard/Sidebar"
import TopBar from "@/components/dashboard/SalesDashboard/TopBar"
import Sales from "@/components/Sales"

export default function TestPage() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Sales />
        </main>
      </div>
    </div>
  )
}
