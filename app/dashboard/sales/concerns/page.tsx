import SalesConcerns from "@/components/dashboard/SalesDashboard/SalesConcerns"
import { getConcernsData } from "@/lib/sales/concerns-data"

export default async function SalesConcernsPage() {
  const data = await getConcernsData()
  return (
    <div className="h-full overflow-y-auto p-6 flex flex-col">
      <SalesConcerns concerns={data.concerns} />
    </div>
  )
}
