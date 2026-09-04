import SalesConcerns from "@/components/dashboard/SalesDashboard/SalesConcerns"
import { getConcernsData } from "@/lib/sales/concerns-data"

export default async function SalesConcernsPage() {
  const data = await getConcernsData()
  return (
    <div className="p-6">
      <SalesConcerns concerns={data.concerns} />
    </div>
  )
}
