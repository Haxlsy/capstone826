import JobConcerns from "@/components/dashboard/OperationComponents/JobConcerns"
import { getConcernsData } from "@/lib/operations/concerns-data"
import { toConcernRecords } from "@/lib/operations/concern-record"

export default async function ConcernsPage() {
  const { concerns } = await getConcernsData()
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <JobConcerns initialRecords={toConcernRecords(concerns)} />
    </div>
  )
}
