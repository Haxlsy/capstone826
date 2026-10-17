import SalesConcerns from "@/components/dashboard/SalesDashboard/SalesConcerns"
import { getConcernsData } from "@/lib/sales/concerns-data"
import { toConcernRecords } from "@/lib/operations/concern-record"

export default async function SalesConcernsPage() {
  const { concerns } = await getConcernsData()
  return (
    <div className="p-4 md:p-6">
      <SalesConcerns initialRecords={toConcernRecords(concerns)} />
    </div>
  )
}
