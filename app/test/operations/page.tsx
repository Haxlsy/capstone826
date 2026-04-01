import OperationsSidebar from "@/components/dashboard/OperationComponents/OperationsSidebar"
import OperationsTopBar from "@/components/dashboard/OperationComponents/OperationsTopBar"
import OperationsDashboard from "@/components/dashboard/OperationComponents/OperationsDashboard"

export default function TestOperationsPage() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <OperationsSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <OperationsTopBar />
        <main className="flex-1 overflow-y-auto">
          <OperationsDashboard />
        </main>
      </div>
    </div>
  )
}
