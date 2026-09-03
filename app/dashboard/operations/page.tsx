import OperationsDashboard from "@/components/dashboard/OperationComponents/OperationsDashboard"
import { getDashboardData } from "@/lib/operations/dashboard-data";

export default async function OperationsPage() {
  const data = await getDashboardData();
  return (
    <div className="p-6">
      <OperationsDashboard {...data} />
    </div>
  )
}
