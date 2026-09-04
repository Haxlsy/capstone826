import JobConcerns from "@/components/dashboard/OperationComponents/JobConcerns"
import { getConcernsData } from "@/lib/operations/concerns-data"
import { toConcernRecords } from "@/lib/operations/concern-record"

export default async function ConcernsPage() {
  const { concerns } = await getConcernsData()
  return (
    <div className="p-6">
      <JobConcerns initialRecords={toConcernRecords(concerns)} />
    </div>
  )
}
